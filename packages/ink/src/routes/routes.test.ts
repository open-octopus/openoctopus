// @ts-nocheck
import { describe, expect, it, vi } from "vitest";

const mockProcessChatMessage = vi.hoisted(() => vi.fn());

vi.mock("../chat-pipeline.js", () => ({
  processChatMessage: (...args: unknown[]) => mockProcessChatMessage(...args),
}));

import { createChatRoutes } from "./chat.js";
import { createEntityRoutes } from "./entities.js";
import { createHealthRoutes } from "./health.js";
import { createRealmRoutes } from "./realms.js";

function mockRes() {
  const res: Record<string, unknown> = {
    statusCode: 200,
    jsonData: undefined,
    ended: false,
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((data: unknown) => {
    res.jsonData = data;
    return res;
  });
  res.end = vi.fn(() => {
    res.ended = true;
    return res;
  });
  return res as unknown as import("express").Response;
}

function mockReq(
  params?: Record<string, string>,
  query?: Record<string, string>,
  body?: Record<string, unknown>,
) {
  return {
    params: params ?? {},
    query: query ?? {},
    body: body ?? {},
  } as unknown as import("express").Request;
}

describe("health routes", () => {
  it("returns ok on /healthz", () => {
    const router = createHealthRoutes();
    const req = mockReq();
    const res = mockRes();

    // @ts-expect-error express handler signature
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/healthz")
      ?.route.stack[0].handle(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toMatchObject({ status: "ok", service: "openoctopus-ink" });
  });

  it("returns ready on /readyz without deps", () => {
    const router = createHealthRoutes();
    const req = mockReq();
    const res = mockRes();

    // @ts-expect-error express handler signature
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/readyz")
      ?.route.stack[0].handle(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toMatchObject({ status: "ready", llm: undefined, channels: undefined });
  });

  it("returns ready on /readyz with deps", () => {
    const llmRegistry = {
      hasRealProvider: vi.fn().mockReturnValue(true),
      listProviders: vi.fn().mockReturnValue(["anthropic"]),
    };
    const channelManager = {
      list: vi.fn().mockReturnValue([{ id: "ch1", name: "telegram" }]),
    };

    const router = createHealthRoutes({ llmRegistry, channelManager });
    const req = mockReq();
    const res = mockRes();

    // @ts-expect-error express handler signature
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/readyz")
      ?.route.stack[0].handle(req, res);

    expect(res.jsonData).toMatchObject({
      status: "ready",
      llm: { hasRealProvider: true, providers: ["anthropic"] },
      channels: [{ id: "ch1", name: "telegram" }],
    });
  });
});

describe("realm routes", () => {
  const mockRealmManager = {
    list: vi.fn().mockReturnValue([{ id: "r1", name: "test" }]),
    get: vi.fn().mockReturnValue({ id: "r1", name: "test" }),
    create: vi.fn().mockReturnValue({ id: "r1", name: "test" }),
    update: vi.fn().mockReturnValue({ id: "r1", name: "updated" }),
    archive: vi.fn().mockReturnValue({ id: "r1", name: "test", status: "archived" }),
    delete: vi.fn(),
    findByName: vi.fn(),
  };

  const router = createRealmRoutes(
    mockRealmManager as unknown as ConstructorParameters<typeof createRealmRoutes>[0],
  );

  it("lists realms", () => {
    const req = mockReq();
    const res = mockRes();
    // @ts-expect-error
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/")
      ?.route.stack[0].handle(req, res);
    expect(res.jsonData).toEqual({ data: [{ id: "r1", name: "test" }] });
  });

  it("gets realm by id", () => {
    const req = mockReq({ id: "r1" });
    const res = mockRes();
    // @ts-expect-error
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/:id")
      ?.route.stack[0].handle(req, res);
    expect(res.jsonData).toEqual({ data: { id: "r1", name: "test" } });
  });

  it("creates realm", () => {
    const req = mockReq({}, {}, { name: "new realm", description: "desc" });
    const res = mockRes();
    // @ts-expect-error
    router.stack
      .find(
        (layer: Record<string, unknown>) => layer.route?.path === "/" && layer.route.methods.post,
      )
      ?.route.stack[0].handle(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.jsonData).toEqual({ data: { id: "r1", name: "test" } });
  });

  it("updates realm", () => {
    const req = mockReq({ id: "r1" }, {}, { name: "updated" });
    const res = mockRes();
    // @ts-expect-error
    const patchLayer = router.stack.find(
      (layer: Record<string, unknown>) => layer.route?.path === "/:id" && layer.route.methods.patch,
    );
    patchLayer?.route.stack[0].handle(req, res);
    expect(res.jsonData).toEqual({ data: { id: "r1", name: "updated" } });
  });

  it("archives realm", () => {
    const req = mockReq({ id: "r1" });
    const res = mockRes();
    // @ts-expect-error
    const archiveLayer = router.stack.find(
      (layer: Record<string, unknown>) => layer.route?.path === "/:id/archive",
    );
    archiveLayer?.route.stack[0].handle(req, res);
    expect(res.jsonData).toEqual({ data: { id: "r1", name: "test", status: "archived" } });
  });

  it("deletes realm", () => {
    const req = mockReq({ id: "r1" });
    const res = mockRes();
    // @ts-expect-error
    const deleteLayer = router.stack.find(
      (layer: Record<string, unknown>) =>
        layer.route?.path === "/:id" && layer.route.methods.delete,
    );
    deleteLayer?.route.stack[0].handle(req, res);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
  });

  it("handles errors", () => {
    mockRealmManager.list.mockImplementation(() => {
      throw new Error("db fail");
    });
    const req = mockReq();
    const res = mockRes();
    // @ts-expect-error
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/")
      ?.route.stack[0].handle(req, res);
    expect(res.statusCode).toBe(500);
  });
});

describe("entity routes", () => {
  const mockEntityManager = {
    listByRealm: vi.fn().mockReturnValue([{ id: "e1", name: "Entity" }]),
    get: vi.fn().mockReturnValue({ id: "e1", name: "Entity" }),
    create: vi.fn().mockReturnValue({ id: "e1", name: "Entity" }),
    update: vi.fn().mockReturnValue({ id: "e1", name: "Updated" }),
    delete: vi.fn(),
  };

  const router = createEntityRoutes(
    mockEntityManager as unknown as ConstructorParameters<typeof createEntityRoutes>[0],
  );

  it("lists entities by realm", () => {
    const req = mockReq({}, { realmId: "r1" });
    const res = mockRes();
    // @ts-expect-error
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/")
      ?.route.stack[0].handle(req, res);
    expect(res.jsonData).toEqual({ data: [{ id: "e1", name: "Entity" }] });
  });

  it("returns 400 when realmId is missing", () => {
    const req = mockReq({}, {});
    const res = mockRes();
    // @ts-expect-error
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/")
      ?.route.stack[0].handle(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("gets entity by id", () => {
    const req = mockReq({ id: "e1" });
    const res = mockRes();
    // @ts-expect-error
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/:id")
      ?.route.stack[0].handle(req, res);
    expect(res.jsonData).toEqual({ data: { id: "e1", name: "Entity" } });
  });

  it("creates entity", () => {
    const req = mockReq({}, {}, { realmId: "r1", name: "Entity", type: "living" });
    const res = mockRes();
    // @ts-expect-error
    router.stack
      .find(
        (layer: Record<string, unknown>) => layer.route?.path === "/" && layer.route.methods.post,
      )
      ?.route.stack[0].handle(req, res);
    expect(res.statusCode).toBe(201);
  });

  it("updates entity", () => {
    const req = mockReq({ id: "e1" }, {}, { name: "Updated" });
    const res = mockRes();
    // @ts-expect-error
    const patchLayer = router.stack.find(
      (layer: Record<string, unknown>) => layer.route?.path === "/:id" && layer.route.methods.patch,
    );
    patchLayer?.route.stack[0].handle(req, res);
    expect(res.jsonData).toEqual({ data: { id: "e1", name: "Updated" } });
  });

  it("deletes entity", () => {
    const req = mockReq({ id: "e1" });
    const res = mockRes();
    // @ts-expect-error
    const deleteLayer = router.stack.find(
      (layer: Record<string, unknown>) =>
        layer.route?.path === "/:id" && layer.route.methods.delete,
    );
    deleteLayer?.route.stack[0].handle(req, res);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
  });
});

describe("chat routes", () => {
  const services = {
    realmManager: {},
    entityManager: {},
    agentRunner: {},
    router: {},
    summonEngine: {},
  };

  const router = createChatRoutes(
    services.realmManager,
    services.entityManager,
    services.agentRunner,
    services.router,
    services.summonEngine,
  );

  it("posts general chat", async () => {
    mockProcessChatMessage.mockResolvedValue({ sessionId: "s1", response: "hello", routing: {} });
    const req = mockReq({}, {}, { message: "hi" });
    const res = mockRes();

    // @ts-expect-error
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/")
      ?.route.stack[0].handle(req, res);
    await new Promise((r) => setTimeout(r, 10));

    expect(res.jsonData).toEqual({
      data: { sessionId: "s1", message: "hello", routing: {} },
    });
  });

  it("posts realm chat", async () => {
    mockProcessChatMessage.mockResolvedValue({
      sessionId: "s1",
      response: "ok",
      realm: { id: "r1" },
    });
    const req = mockReq({ realmId: "r1" }, {}, { message: "hi" });
    const res = mockRes();

    // @ts-expect-error
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/realm/:realmId")
      ?.route.stack[0].handle(req, res);
    await new Promise((r) => setTimeout(r, 10));

    expect(res.jsonData).toEqual({
      data: { sessionId: "s1", message: "ok", realm: { id: "r1" } },
    });
  });

  it("posts entity chat", async () => {
    mockProcessChatMessage.mockResolvedValue({
      sessionId: "s1",
      response: "ok",
      entity: { id: "e1" },
    });
    const req = mockReq({ entityId: "e1" }, {}, { message: "hi" });
    const res = mockRes();

    // @ts-expect-error
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/entity/:entityId")
      ?.route.stack[0].handle(req, res);
    await new Promise((r) => setTimeout(r, 10));

    expect(res.jsonData).toEqual({
      data: { sessionId: "s1", message: "ok", entity: { id: "e1" } },
    });
  });

  it("handles chat errors", async () => {
    mockProcessChatMessage.mockRejectedValue(new Error("fail"));
    const req = mockReq({}, {}, { message: "hi" });
    const res = mockRes();

    // @ts-expect-error
    router.stack
      .find((layer: Record<string, unknown>) => layer.route?.path === "/")
      ?.route.stack[0].handle(req, res);
    await new Promise((r) => setTimeout(r, 10));

    expect(res.statusCode).toBe(500);
  });
});
