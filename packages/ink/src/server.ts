import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ChannelManager } from "@openoctopus/channels";
import {
  RealmManager,
  EntityManager,
  AgentRunner,
  Router,
  SkillRegistry,
  LlmProviderRegistry,
  RealmLoader,
  MemoryExtractor,
  MemoryHealthManager,
  KnowledgeDistributor,
  MaturityScanner,
  CrossRealmReactor,
  DirectoryScanner,
  EmbeddingProviderRegistry,
  Scheduler,
} from "@openoctopus/core";
import {
  createLogger,
  loadConfig,
  type OpenOctopusConfig,
  toErrorResponse,
} from "@openoctopus/shared";
import {
  createDatabase,
  MemoryRepo,
  HealthReportRepo,
  ScannedFileRepo,
  type DatabaseOptions,
} from "@openoctopus/storage";
import { SummonEngine } from "@openoctopus/summon";
import type Database from "better-sqlite3";
import express from "express";
import { WebSocketServer } from "ws";
import { processChatMessage } from "./chat-pipeline.js";
import { createChatRoutes } from "./routes/chat.js";
import { createEntityRoutes } from "./routes/entities.js";
import { createHealthRoutes } from "./routes/health.js";
import { createRealmRoutes } from "./routes/realms.js";
import type { RpcServices } from "./rpc-handlers.js";
import { setupWebSocket } from "./ws.js";

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

  // Initialize embedding provider registry from config
  const embeddingRegistry = new EmbeddingProviderRegistry(config.embeddings);

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
  const knowledgeDistributor = new KnowledgeDistributor(
    memoryRepo,
    realmManager,
    entityManager,
    llmRegistry,
  );
  const memoryExtractor = new MemoryExtractor(
    memoryRepo,
    llmRegistry,
    knowledgeDistributor,
    embeddingRegistry,
  );
  const memoryHealthManager = new MemoryHealthManager(
    memoryRepo,
    realmManager,
    entityManager,
    healthReportRepo,
    llmRegistry,
  );
  const maturityScanner = new MaturityScanner(memoryRepo, entityManager, realmManager);
  const crossRealmReactor = new CrossRealmReactor(
    realmManager,
    summonEngine,
    agentRunner,
    llmRegistry,
  );
  const directoryScanner = new DirectoryScanner(knowledgeDistributor, scannedFileRepo, llmRegistry);

  // Load realms from REALM.md files (also seeds default entities)
  const realmLoader = new RealmLoader(realmManager, entityManager);
  await realmLoader.loadFromDirectory(path.resolve(process.cwd(), "realms"));

  // ── Scheduler for proactive behavior and health checks ──
  const scheduler = new Scheduler();

  // Built-in health check rules
  scheduler.addRule({
    id: "system.health.daily",
    trigger: "0 3 * * *", // Daily at 03:00
    action: "system:health.computeAll",
    enabled: true,
  });

  scheduler.addRule({
    id: "system.maturity.daily",
    trigger: "30 3 * * *", // Daily at 03:30
    action: "system:maturity.scanAll",
    enabled: true,
  });

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
    embeddingRegistry,
    scheduler,
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
  app.use(
    "/api/chat",
    createChatRoutes(realmManager, entityManager, agentRunner, router, summonEngine),
  );

  // Serve static web chat page
  const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
  app.use(express.static(publicDir));

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    },
  );

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

  // ── Wire Scheduler action handlers ──
  scheduler.setActionHandler(async (rule) => {
    if (rule.action.startsWith("system:")) {
      // System rules — health checks and maturity scans
      if (rule.action === "system:health.computeAll") {
        log.info("Scheduled health computation for all realms");
        const reports = await memoryHealthManager.computeAllHealth();

        // Persist each report
        for (const report of reports) {
          // Get previous score before saving new report
          const previous = healthReportRepo.getLatest(report.realmId);
          const previousScore = previous?.healthScore;

          // Convert RealmHealthReport to HealthReportRepo format
          await healthReportRepo.create({
            realmId: report.realmId,
            healthScore: report.healthScore,
            memoryCount: report.memoryCount,
            duplicateCount: report.duplicateCount,
            staleCount: report.staleCount,
            contradictionCount: report.contradictionCount,
            issues: report.issues,
          });

          // Broadcast alert if score changed significantly (> 10 points)
          if (previousScore !== undefined && Math.abs(report.healthScore - previousScore) > 10) {
            const realm = realmManager.get(report.realmId);
            rpcServices.wsBroadcaster?.broadcast({
              jsonrpc: "2.0",
              method: "health.alert",
              params: {
                realmId: report.realmId,
                realmName: realm?.name ?? "Unknown",
                previousScore,
                currentScore: report.healthScore,
                delta: report.healthScore - previousScore,
                issues: report.issues.slice(0, 3),
              },
            });
          }
        }

        log.info(`Health computed for ${reports.length} realms`);
        return;
      }

      if (rule.action === "system:maturity.scanAll") {
        log.info("Scheduled maturity scan for all realms");
        const suggestions = maturityScanner.scanAll();

        // Broadcast summon suggestions for ready entities
        for (const s of suggestions) {
          rpcServices.wsBroadcaster?.broadcast({
            jsonrpc: "2.0",
            method: "maturity.ready",
            params: s,
          });
        }

        log.info(`Maturity scan complete, ${suggestions.length} entities ready to summon`);
        return;
      }
    }

    // User rules — proactive agent responses
    if (rule.realmId) {
      log.info(`Executing proactive rule: ${rule.id}`);
      const result = await agentRunner.run({
        agent: {
          id: `proactive-${rule.id}`,
          name: `Proactive Agent`,
          tier: "central",
          model: "default",
          skills: [],
          proactive: true,
        },
        messages: [
          {
            role: "user",
            content: rule.prompt ?? `Scheduled trigger: ${rule.trigger}`,
            timestamp: new Date().toISOString(),
          },
        ],
        systemPrompt:
          "You are a proactive assistant. Generate a brief, helpful notification based on the scheduled trigger.",
      });

      // Broadcast proactive message to connected clients
      rpcServices.wsBroadcaster?.broadcast({
        jsonrpc: "2.0",
        method: "proactive",
        params: {
          ruleId: rule.id,
          realmId: rule.realmId,
          content: result.response.content,
          tokensUsed: result.tokensUsed,
        },
      });
    }
  });

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

  // Start scheduler for proactive behavior and health checks
  scheduler.start();
  log.info("Scheduler started");

  log.info(`Ink HTTP bridge listening on http://${host}:${httpPort}`);
  log.info(`Ink WebSocket RPC listening on ws://${host}:${wsPort}`);
  const realmCount = realmManager.list().length;
  log.info(`Realms: ${realmCount} loaded`);
  log.info(`LLM providers: ${llmRegistry.listProviders().join(", ")}`);
  if (embeddingRegistry.hasProvider()) {
    log.info(`Embedding providers: ${embeddingRegistry.listProviders().join(", ")}`);
  }

  const activeChannels = channelManager.list().filter((c) => c.running);
  if (activeChannels.length > 0) {
    log.info(`Channels: ${activeChannels.map((c) => c.name).join(", ")}`);
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

      // 1. Stop scheduler
      scheduler.stop();
      log.info("Scheduler stopped");

      // 2. Stop channels
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
        new Promise<void>((r) => httpServer.close(() => r())),
        new Promise<void>((r) => wsServer.close(() => r())),
      ]);

      // 5. Close database
      db.close();

      log.info("Ink gateway shut down");
    },
  };
}
