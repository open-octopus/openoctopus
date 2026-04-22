import type { ChannelManager } from "@openoctopus/channels";
import type { LlmProviderRegistry } from "@openoctopus/core";
import { Router } from "express";

interface HealthDeps {
  llmRegistry?: LlmProviderRegistry;
  channelManager?: ChannelManager;
}

export function createHealthRoutes(deps?: HealthDeps): Router {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      service: "openoctopus-ink",
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/readyz", (_req, res) => {
    const llm = deps?.llmRegistry
      ? {
          hasRealProvider: deps.llmRegistry.hasRealProvider(),
          providers: deps.llmRegistry.listProviders(),
        }
      : undefined;

    const channels = deps?.channelManager ? deps.channelManager.list() : undefined;

    res.json({
      status: "ready",
      timestamp: new Date().toISOString(),
      llm,
      channels,
    });
  });

  return router;
}
