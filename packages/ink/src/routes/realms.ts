import { Router } from "express";
import type { RealmManager } from "@openoctopus/core";
import { toErrorResponse } from "@openoctopus/shared";

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
      const { name, description, icon } = req.body as { name: string; description?: string; icon?: string };
      const realm = realmManager.create({ name, description, icon });
      res.status(201).json({ data: realm });
    } catch (err) {
      const response = toErrorResponse(err);
      res.status(response.status).json(response);
    }
  });

  // Update realm
  router.patch("/:id", (req, res) => {
    try {
      const realm = realmManager.update(req.params.id, req.body as Record<string, string>);
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
