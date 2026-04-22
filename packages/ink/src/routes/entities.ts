import type { EntityManager } from "@openoctopus/core";
import { toErrorResponse, ValidationError } from "@openoctopus/shared";
import { Router } from "express";
import { z } from "zod";

const CreateEntitySchema = z.object({
  realmId: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum(["living", "asset", "organization", "abstract"]),
  avatar: z.string().max(500).optional(),
  attributes: z.record(z.unknown()).optional(),
  soulPath: z.string().max(500).optional(),
});

const UpdateEntitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["living", "asset", "organization", "abstract"]).optional(),
  avatar: z.string().max(500).optional(),
  attributes: z.record(z.unknown()).optional(),
});

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
      const parsed = CreateEntitySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));
      }
      const entity = entityManager.create(parsed.data);
      res.status(201).json({ data: entity });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Update entity
  router.patch("/:id", (req, res) => {
    try {
      const parsed = UpdateEntitySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));
      }
      const entity = entityManager.update(req.params.id, parsed.data);
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
