import { describe, expect, it } from "vitest";
import { extractPrefix, generateId, isValidId } from "./ids.js";

describe("generateId", () => {
  it("generates an id with the given prefix", () => {
    const id = generateId("realm");
    expect(id).toMatch(/^realm_[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("entity")));
    expect(ids.size).toBe(100);
  });
});

describe("extractPrefix", () => {
  it("extracts prefix from valid id", () => {
    expect(extractPrefix("realm_abc-123")).toBe("realm");
  });

  it("returns null for invalid id", () => {
    expect(extractPrefix("nounderscore")).toBeNull();
  });
});

describe("isValidId", () => {
  it("validates a correct id", () => {
    const id = generateId("agent");
    expect(isValidId(id)).toBe(true);
    expect(isValidId(id, "agent")).toBe(true);
  });

  it("rejects wrong prefix", () => {
    const id = generateId("agent");
    expect(isValidId(id, "realm")).toBe(false);
  });

  it("rejects invalid format", () => {
    expect(isValidId("agent_not-a-uuid")).toBe(false);
    expect(isValidId("")).toBe(false);
  });
});
