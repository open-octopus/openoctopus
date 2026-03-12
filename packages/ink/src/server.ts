import http from "node:http";
import express from "express";
import { WebSocketServer } from "ws";
import type Database from "better-sqlite3";
import { createLogger, loadConfig, type OpenOctopusConfig, toErrorResponse } from "@openoctopus/shared";
import { createDatabase, MemoryRepo, HealthReportRepo, ScannedFileRepo, type DatabaseOptions } from "@openoctopus/storage";
import path from "node:path";
import { RealmManager, EntityManager, AgentRunner, Router, SkillRegistry, LlmProviderRegistry, RealmLoader, MemoryExtractor, MemoryHealthManager, KnowledgeDistributor, MaturityScanner, CrossRealmReactor, DirectoryScanner } from "@openoctopus/core";
import { SummonEngine } from "@openoctopus/summon";
import { ChannelManager } from "@openoctopus/channels";
import { createRealmRoutes } from "./routes/realms.js";
import { createEntityRoutes } from "./routes/entities.js";
import { createChatRoutes } from "./routes/chat.js";
import { createHealthRoutes } from "./routes/health.js";
import { setupWebSocket } from "./ws.js";
import type { RpcServices } from "./rpc-handlers.js";
import { processChatMessage } from "./chat-pipeline.js";

const log = createLogger("ink");

export interface InkServerOptions {
  port?: number;
  wsPort?: number;
  database?: DatabaseOptions;
  config?: OpenOctopusConfig;
}

export interface InkServer {
  app: express.Express;
  httpServer: http.Server;
  wsServer: http.Server;
  db: Database.Database;
  httpPort: number;
  wsPort: number;
  close: () => Promise<void>;
  /** @deprecated Use httpServer */
  server: http.Server;
}

export async function createServer(options: InkServerOptions = {}): Promise<InkServer> {
  const config = options.config ?? loadConfig();
  const httpPort = options.port ?? config.gateway.httpPort;
  const wsPort = options.wsPort ?? config.gateway.wsPort;
  const db = createDatabase(options.database);

  // Initialize LLM provider registry from config
  const llmRegistry = new LlmProviderRegistry(config.llm);

  // Initialize core services
  const realmManager = new RealmManager(db);
  const entityManager = new EntityManager(db);
  const agentRunner = new AgentRunner(llmRegistry);
  const router = new Router(llmRegistry);
  const _skillRegistry = new SkillRegistry();
  const summonEngine = new SummonEngine(db);

  // Initialize memory
  const memoryRepo = new MemoryRepo(db);
  const healthReportRepo = new HealthReportRepo(db);
  const scannedFileRepo = new ScannedFileRepo(db);

  // Knowledge lifecycle services
  const knowledgeDistributor = new KnowledgeDistributor(memoryRepo, realmManager, entityManager, llmRegistry);
  const memoryExtractor = new MemoryExtractor(memoryRepo, llmRegistry, knowledgeDistributor);
  const memoryHealthManager = new MemoryHealthManager(memoryRepo, realmManager, entityManager, healthReportRepo, llmRegistry);
  const maturityScanner = new MaturityScanner(memoryRepo, entityManager, realmManager);
  const crossRealmReactor = new CrossRealmReactor(realmManager, summonEngine, agentRunner, llmRegistry);
  const directoryScanner = new DirectoryScanner(knowledgeDistributor, scannedFileRepo, llmRegistry);

  // Load realms from REALM.md files (also seeds default entities)
  const realmLoader = new RealmLoader(realmManager, entityManager);
  await realmLoader.loadFromDirectory(path.resolve(process.cwd(), "realms"));

  // Initialize channel manager
  const channelManager = new ChannelManager();
  if (config.channels && Object.keys(config.channels).length > 0) {
    channelManager.loadFromConfig(config.channels);
  }

  const startTime = Date.now();

  const rpcServices: RpcServices = {
    realmManager,
    entityManager,
    agentRunner,
    router,
    summonEngine,
    channelManager,
    llmRegistry,
    realmLoader,
    memoryRepo,
    memoryExtractor,
    memoryHealthManager,
    knowledgeDistributor,
    maturityScanner,
    crossRealmReactor,
    directoryScanner,
    startTime,
  };

  // ── HTTP Server (port 18790 — REST API bridge) ──
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    log.debug(`${req.method} ${req.path}`);
    next();
  });

  app.use("/", createHealthRoutes({ llmRegistry, channelManager }));
  app.use("/api/realms", createRealmRoutes(realmManager));
  app.use("/api/entities", createEntityRoutes(entityManager));
  app.use("/api/chat", createChatRoutes(realmManager, entityManager, agentRunner, router, summonEngine));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const response = toErrorResponse(err);
    res.status(response.status).json(response);
  });

  const httpServer = http.createServer(app);

  // ── WebSocket RPC Server (port 18789 — primary gateway) ──
  const wsServer = http.createServer((_req, res) => {
    // Minimal HTTP on WS port: health probe only
    if (_req.url === "/healthz" || _req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "openoctopus-ink-ws" }));
      return;
    }
    res.writeHead(426, { "Content-Type": "text/plain" });
    res.end("WebSocket upgrade required");
  });

  const wss = new WebSocketServer({ server: wsServer });
  const wsBroadcasterPrimary = setupWebSocket(wss, rpcServices);

  // Also mount WebSocket on HTTP server at /ws for backward compat
  const wssLegacy = new WebSocketServer({ server: httpServer, path: "/ws" });
  const wsBroadcasterLegacy = setupWebSocket(wssLegacy, rpcServices);

  // Compose broadcasters to send to all connected clients
  rpcServices.wsBroadcaster = {
    broadcast: (data) => {
      wsBroadcasterPrimary.broadcast(data);
      wsBroadcasterLegacy.broadcast(data);
    },
  };

  // ── Wire channels into chat pipeline (with streaming support) ──
  channelManager.setStreamingHandler(async (msg, onToken) => {
    try {
      const result = await processChatMessage({
        message: msg.text,
        services: rpcServices,
        onToken,
      });
      return { text: result.response.content };
    } catch (err) {
      log.error(`Channel message error: ${err instanceof Error ? err.message : String(err)}`);
      return { text: "Sorry, I encountered an error processing your message." };
    }
  });

  // ── Start both servers ──
  const host = config.gateway.host;

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      httpServer.listen(httpPort, host, () => resolve());
      httpServer.once("error", reject);
    }),
    new Promise<void>((resolve, reject) => {
      wsServer.listen(wsPort, host, () => resolve());
      wsServer.once("error", reject);
    }),
  ]);

  // Start channels after servers are ready
  await channelManager.startAll();

  log.info(`Ink HTTP bridge listening on http://${host}:${httpPort}`);
  log.info(`Ink WebSocket RPC listening on ws://${host}:${wsPort}`);
  const realmCount = realmManager.list().length;
  log.info(`Realms: ${realmCount} loaded`);
  log.info(`LLM providers: ${llmRegistry.listProviders().join(", ")}`);

  const activeChannels = channelManager.list().filter(c => c.running);
  if (activeChannels.length > 0) {
    log.info(`Channels: ${activeChannels.map(c => c.name).join(", ")}`);
  } else {
    log.info("Channels: none configured");
  }

  if (llmRegistry.hasRealProvider()) {
    log.info("LLM ready — real provider configured");
  } else {
    log.warn("No LLM provider configured — using stub responses. Add API keys to config.json5");
  }

  return {
    app,
    httpServer,
    wsServer,
    server: httpServer,
    db,
    httpPort,
    wsPort,
    close: async () => {
      log.info("Shutting down...");

      // 1. Stop channels
      await channelManager.stopAll();

      // 2. Close WS connections with 1001 (Going Away)
      for (const client of wss.clients) {
        client.close(1001, "Server shutting down");
      }
      for (const client of wssLegacy.clients) {
        client.close(1001, "Server shutting down");
      }

      // 3. Close WebSocket servers
      wss.close();
      wssLegacy.close();

      // 4. Close HTTP servers
      await Promise.all([
        new Promise<void>(r => httpServer.close(() => r())),
        new Promise<void>(r => wsServer.close(() => r())),
      ]);

      // 5. Close database
      db.close();

      log.info("Ink gateway shut down");
    },
  };
}
