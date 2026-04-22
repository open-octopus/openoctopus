import type { RealmManager } from "@openoctopus/core";
import { toErrorResponse, ValidationError } from "@openoctopus/shared";
import { Router } from "express";
import { z } from "zod";

const CreateRealmSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
});

const UpdateRealmSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export function createRealmRoutes(realmManager: RealmManager): Router {
  const router = Router();

  // List all realms
  router.get("/", (_req, res) => {
    try {
      const realms = realmManager.list();
      res.json({ data: realms });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Get realm by ID
  router.get("/:id", (req, res) => {
    try {
      const realm = realmManager.get(req.params.id);
      res.json({ data: realm });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Create realm
  router.post("/", (req, res) => {
    try {
      const parsed = CreateRealmSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));
      }
      const realm = realmManager.create(parsed.data);
      res.status(201).json({ data: realm });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Update realm
  router.patch("/:id", (req, res) => {
    try {
      const parsed = UpdateRealmSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));
      }
      const realm = realmManager.update(req.params.id, parsed.data);
      res.json({ data: realm });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Archive realm
  router.post("/:id/archive", (req, res) => {
    try {
      const realm = realmManager.archive(req.params.id);
      res.json({ data: realm });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Delete realm
  router.delete("/:id", (req, res) => {
    try {
      realmManager.delete(req.params.id);
      res.status(204).end();
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  return router;
}
