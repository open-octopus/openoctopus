import { describe, it, expect, vi, beforeEach } from "vitest";
import { entityCommand } from "./entity.js";

const mockGet = vi.fn();
const mockPost = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("../api-client.js", () => ({
  ApiClient: class {
    get = mockGet;
    post = mockPost;
  },
}));

describe("entityCommand", () => {
  describe("list", () => {
    it("lists entities in a realm", async () => {
      mockGet.mockResolvedValue({
        data: [
          {
            id: "e1",
            name: "Alice",
            type: "living",
            summonStatus: "active",
            realmId: "r1",
            attributes: {},
            createdAt: "2024-01-01",
          },
          {
            id: "e2",
            name: "House",
            type: "asset",
            summonStatus: "inactive",
            realmId: "r1",
            attributes: {},
            createdAt: "2024-01-02",
          },
        ],
      });

      await ((entityCommand.subCommands as any).list.run as any)({ args: { realm: "r1" } });

      expect(mockGet).toHaveBeenCalledWith("/api/entities?realmId=r1");
    });

    it("shows message when no entities found", async () => {
      mockGet.mockResolvedValue({ data: [] });

      await ((entityCommand.subCommands as any).list.run as any)({ args: { realm: "r1" } });

      expect(mockGet).toHaveBeenCalledWith("/api/entities?realmId=r1");
    });
  });

  describe("add", () => {
    it("creates an entity", async () => {
      mockPost.mockResolvedValue({
        data: { id: "e1", name: "Alice", type: "living", realmId: "r1" },
      });

      await ((entityCommand.subCommands as any).add.run as any)({
        args: { name: "Alice", realm: "r1", type: "living" },
      });

      expect(mockPost).toHaveBeenCalledWith("/api/entities", {
        realmId: "r1",
        name: "Alice",
        type: "living",
      });
    });
  });

  describe("info", () => {
    it("shows entity details", async () => {
      mockGet.mockResolvedValue({
        data: {
          id: "e1",
          name: "Alice",
          type: "living",
          realmId: "r1",
          summonStatus: "active",
          attributes: {},
          createdAt: "2024-01-01",
        },
      });

      await ((entityCommand.subCommands as any).info.run as any)({ args: { id: "e1" } });

      expect(mockGet).toHaveBeenCalledWith("/api/entities/e1");
    });
  });
});
