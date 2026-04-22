import { describe, it, expect } from "vitest";
import {
  RpcRequestSchema,
  RpcResponseSchema,
  RpcEventSchema,
  createRpcRequest,
  createRpcResponse,
  createRpcEvent,
  RPC_METHODS,
  RPC_EVENTS,
} from "./rpc-protocol.js";

describe("rpc-protocol", () => {
  it("validates RpcRequest", () => {
    const req = { id: "1", method: "test", params: { a: 1 } };
    expect(RpcRequestSchema.parse(req)).toEqual(req);
  });

  it("validates RpcRequest with default params", () => {
    const req = { id: "1", method: "test" };
    expect(RpcRequestSchema.parse(req).params).toEqual({});
  });

  it("validates RpcResponse", () => {
    const res = { id: "1", result: { ok: true } };
    expect(RpcResponseSchema.parse(res)).toEqual(res);
  });

  it("validates RpcEvent", () => {
    const evt = { event: "token", data: "hi" };
    expect(RpcEventSchema.parse(evt)).toEqual(evt);
  });

  it("creates RpcRequest with generated id", () => {
    const req = createRpcRequest("chat.send", { message: "hi" });
    expect(req.method).toBe("chat.send");
    expect(req.params).toEqual({ message: "hi" });
    expect(req.id).toMatch(/^rpc_\d+_[a-z0-9]+$/);
  });

  it("creates RpcRequest without params", () => {
    const req = createRpcRequest("status.health");
    expect(req.params).toEqual({});
  });

  it("creates RpcResponse", () => {
    const res = createRpcResponse("1", { ok: true });
    expect(res.id).toBe("1");
    expect(res.result).toEqual({ ok: true });
    expect(res.error).toBeUndefined();
  });

  it("creates RpcResponse with error", () => {
    const res = createRpcResponse("1", undefined, { code: -1, message: "fail" });
    expect(res.error).toEqual({ code: -1, message: "fail" });
  });

  it("creates RpcEvent", () => {
    const evt = createRpcEvent("chat.token", "hello", "req1");
    expect(evt.event).toBe("chat.token");
    expect(evt.data).toBe("hello");
    expect(evt.requestId).toBe("req1");
  });

  it("RPC_METHODS contains expected methods", () => {
    expect(RPC_METHODS.CHAT_SEND).toBe("chat.send");
    expect(RPC_METHODS.REALM_LIST).toBe("realm.list");
  });

  it("RPC_EVENTS contains expected events", () => {
    expect(RPC_EVENTS.TOKEN).toBe("chat.token");
    expect(RPC_EVENTS.DONE).toBe("chat.done");
  });
});
