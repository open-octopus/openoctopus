import type { EntityManager } from "@openoctopus/core";
import { toErrorResponse } from "@openoctopus/shared";
import type { Entity } from "@openoctopus/shared";
import { Router } from "express";

export function createEntityRoutes(entityManager: EntityManager): Router {
  const router = Router();

  // List entities by realm
  router.get("/", (req, res) => {
    try {
      const realmId = req.query.realmId as string;
      if (!realmId) {
        res.status(400).json({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "realmId query parameter is required",
        });
        return;
      }
      const entities = entityManager.listByRealm(realmId);
      res.json({ data: entities });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Get entity by ID
  router.get("/:id", (req, res) => {
    try {
      const entity = entityManager.get(req.params.id);
      res.json({ data: entity });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Create entity
  router.post("/", (req, res) => {
    try {
      const body = req.body as {
        realmId: string;
        name: string;
        type: Entity["type"];
        avatar?: string;
        attributes?: Record<string, unknown>;
        soulPath?: string;
      };
      const entity = entityManager.create(body);
      res.status(201).json({ data: entity });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Update entity
  router.patch("/:id", (req, res) => {
    try {
      const entity = entityManager.update(req.params.id, req.body as Record<string, unknown>);
      res.json({ data: entity });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Delete entity
  router.delete("/:id", (req, res) => {
    try {
      entityManager.delete(req.params.id);
      res.status(204).end();
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  return router;
}
