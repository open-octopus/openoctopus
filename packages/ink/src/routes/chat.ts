import type {
  RealmManager,
  EntityManager,
  AgentRunner,
  Router as IntentRouter,
} from "@openoctopus/core";
import { toErrorResponse } from "@openoctopus/shared";
import type { SummonEngine } from "@openoctopus/summon";
import { Router } from "express";
import type { Request, Response } from "express";
import { processChatMessage } from "../chat-pipeline.js";
import type { RpcServices } from "../rpc-handlers.js";

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    });
  };
}

export function createChatRoutes(
  realmManager: RealmManager,
  entityManager: EntityManager,
  agentRunner: AgentRunner,
  router: IntentRouter,
  summonEngine: SummonEngine,
): Router {
  const chatRouter = Router();

  const services: RpcServices = {
    realmManager,
    entityManager,
    agentRunner,
    router,
    summonEngine,
  };

  // General chat with auto-routing
  chatRouter.post(
    "/",
    asyncHandler(async (req, res) => {
      try {
        const { message, sessionId } = req.body as { message: string; sessionId?: string };

        const result = await processChatMessage({ message, sessionId, services });

        res.json({
          data: {
            sessionId: result.sessionId,
            message: result.response,
            routing: result.routing,
          },
        });
      } catch (err) {
        const response = toErrorResponse(err);
        res.status(response.status).json(response);
      }
    }),
  );

  // Chat with specific realm
  chatRouter.post(
    "/realm/:realmId",
    asyncHandler(async (req, res) => {
      try {
        const { message, sessionId } = req.body as { message: string; sessionId?: string };
        const realmId = req.params.realmId as string;

        const result = await processChatMessage({ message, sessionId, realmId, services });

        res.json({
          data: {
            sessionId: result.sessionId,
            message: result.response,
            realm: result.realm,
          },
        });
      } catch (err) {
        const response = toErrorResponse(err);
        res.status(response.status).json(response);
      }
    }),
  );

  // Chat with specific entity (summoned)
  chatRouter.post(
    "/entity/:entityId",
    asyncHandler(async (req, res) => {
      try {
        const { message, sessionId } = req.body as { message: string; sessionId?: string };
        const entityId = req.params.entityId as string;

        const result = await processChatMessage({ message, sessionId, entityId, services });

        res.json({
          data: {
            sessionId: result.sessionId,
            message: result.response,
            entity: result.entity,
          },
        });
      } catch (err) {
        const response = toErrorResponse(err);
        res.status(response.status).json(response);
      }
    }),
  );

  return chatRouter;
}
