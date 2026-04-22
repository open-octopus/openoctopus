import { describe, expect, it } from "vitest";
import {
  ConflictError,
  EntityNotFoundError,
  NotFoundError,
  OpenOctopusError,
  RealmNotFoundError,
  ValidationError,
  toErrorResponse,
} from "./errors.js";

describe("OpenOctopusError", () => {
  it("creates error with code and status", () => {
    const err = new OpenOctopusError("test", "TEST", 418);
    expect(err.message).toBe("test");
    expect(err.code).toBe("TEST");
    expect(err.status).toBe(418);
    expect(err.name).toBe("OpenOctopusError");
  });
});

describe("NotFoundError", () => {
  it("creates 404 error", () => {
    const err = new NotFoundError("Realm", "realm_123");
    expect(err.status).toBe(404);
    expect(err.message).toContain("realm_123");
  });
});

describe("ValidationError", () => {
  it("creates 400 error", () => {
    const err = new ValidationError("invalid input");
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });
});

describe("ConflictError", () => {
  it("creates 409 error", () => {
    const err = new ConflictError("already exists");
    expect(err.status).toBe(409);
  });
});

describe("domain errors", () => {
  it("RealmNotFoundError", () => {
    const err = new RealmNotFoundError("r1");
    expect(err.message).toBe("Realm not found: r1");
  });

  it("EntityNotFoundError", () => {
    const err = new EntityNotFoundError("e1");
    expect(err.message).toBe("Entity not found: e1");
  });
});

describe("toErrorResponse", () => {
  it("converts OpenOctopusError", () => {
    const res = toErrorResponse(new ValidationError("bad"));
    expect(res).toEqual({ status: 400, code: "VALIDATION_ERROR", message: "bad" });
  });

  it("sanitizes unknown error to generic message", () => {
    const res = toErrorResponse(new Error("oops"));
    expect(res).toEqual({ status: 500, code: "INTERNAL_ERROR", message: "Internal server error" });
  });

  it("sanitizes non-error to generic message", () => {
    const res = toErrorResponse("string error");
    expect(res).toEqual({ status: 500, code: "INTERNAL_ERROR", message: "Internal server error" });
  });
});
