import { describe, expect, it, vi } from "vitest";
import { ApiClient, WsRpcClient } from "./api-client.js";

describe("ApiClient", () => {
  it("get returns parsed JSON on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    } as unknown as Response);

    const client = new ApiClient(19790);
    const result = await client.get<{ status: string }>("/healthz");
    expect(result.status).toBe("ok");
  });

  it("get throws on error response with message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Server error" }),
    } as unknown as Response);

    const client = new ApiClient(19790);
    await expect(client.get("/fail")).rejects.toThrow("Server error");
  });

  it("get throws on error response without message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as unknown as Response);

    const client = new ApiClient(19790);
    await expect(client.get("/missing")).rejects.toThrow("Request failed: 404");
  });

  it("post sends JSON body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "r1" }),
    } as unknown as Response);

    const client = new ApiClient(19790);
    const result = await client.post("/realms", { name: "test" });
    expect(result).toEqual({ id: "r1" });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
  });

  it("patch sends JSON body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ updated: true }),
    } as unknown as Response);

    const client = new ApiClient(19790);
    const result = await client.patch("/realms/r1", { name: "new" });
    expect(result).toEqual({ updated: true });
  });

  it("delete resolves on 204", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    } as unknown as Response);

    const client = new ApiClient(19790);
    await expect(client.delete("/realms/r1")).resolves.toBeUndefined();
  });

  it("delete throws on error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "fail" }),
    } as unknown as Response);

    const client = new ApiClient(19790);
    await expect(client.delete("/realms/r1")).rejects.toThrow("fail");
  });

  it("healthCheck returns true on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    } as unknown as Response);

    const client = new ApiClient(19790);
    expect(await client.healthCheck()).toBe(true);
  });

  it("healthCheck returns false on failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network"));

    const client = new ApiClient(19790);
    expect(await client.healthCheck()).toBe(false);
  });

  it("uses env port when not provided", () => {
    const originalPort = process.env.OPENOCTOPUS_PORT;
    process.env.OPENOCTOPUS_PORT = "9999";
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) } as unknown as Response);

    const client = new ApiClient();
    client.get("/test");

    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(":9999");

    if (originalPort !== undefined) {
      process.env.OPENOCTOPUS_PORT = originalPort;
    } else {
      delete process.env.OPENOCTOPUS_PORT;
    }
  });
});

describe("WsRpcClient", () => {
  it("isConnected returns false initially", () => {
    const client = new WsRpcClient(19789);
    expect(client.isConnected()).toBe(false);
  });

  it("tryConnect returns false when connection fails", async () => {
    const client = new WsRpcClient(19789);
    const result = await client.tryConnect();
    expect(result).toBe(false);
  });

  it("throws when calling without connection", async () => {
    const client = new WsRpcClient(19789);
    await expect(client.call("test")).rejects.toThrow("Not connected to gateway");
  });
});
