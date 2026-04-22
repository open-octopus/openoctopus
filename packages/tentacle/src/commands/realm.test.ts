import { describe, it, expect, vi, beforeEach } from "vitest";
import { realmCommand } from "./realm.js";

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

describe("realmCommand", () => {
  describe("list", () => {
    it("lists realms", async () => {
      mockGet.mockResolvedValue({
        data: [
          {
            id: "r1",
            name: "Finance",
            status: "active",
            healthScore: 90,
            description: "Money",
            createdAt: "2024-01-01",
          },
        ],
      });

      await ((realmCommand.subCommands as any).list.run as any)({ args: {} });

      expect(mockGet).toHaveBeenCalledWith("/api/realms");
    });

    it("shows message when no realms found", async () => {
      mockGet.mockResolvedValue({ data: [] });

      await ((realmCommand.subCommands as any).list.run as any)({ args: {} });

      expect(mockGet).toHaveBeenCalledWith("/api/realms");
    });
  });

  describe("create", () => {
    it("creates a realm", async () => {
      mockPost.mockResolvedValue({
        data: { id: "r1", name: "Health", description: "Wellness" },
      });

      await ((realmCommand.subCommands as any).create.run as any)({
        args: { name: "Health", description: "Wellness" },
      });

      expect(mockPost).toHaveBeenCalledWith("/api/realms", {
        name: "Health",
        description: "Wellness",
      });
    });
  });

  describe("info", () => {
    it("shows realm details", async () => {
      mockGet.mockResolvedValue({
        data: {
          id: "r1",
          name: "Finance",
          status: "active",
          healthScore: 90,
          description: "Money",
          createdAt: "2024-01-01",
          lastActivity: "2024-01-02",
        },
      });

      await ((realmCommand.subCommands as any).info.run as any)({ args: { id: "r1" } });

      expect(mockGet).toHaveBeenCalledWith("/api/realms/r1");
    });
  });

  describe("archive", () => {
    it("archives a realm", async () => {
      mockPost.mockResolvedValue({});

      await ((realmCommand.subCommands as any).archive.run as any)({ args: { id: "r1" } });

      expect(mockPost).toHaveBeenCalledWith("/api/realms/r1/archive");
    });
  });
});
