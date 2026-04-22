import fs from "node:fs";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  detectInstallKind,
  detectPackageManager,
  fetchLatestVersion,
  getCurrentVersion,
} from "./update-check.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("update-check", () => {
  describe("detectInstallKind", () => {
    it("returns git when pnpm-workspace.yaml exists", () => {
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
      expect(detectInstallKind()).toBe("git");
      existsSpy.mockRestore();
    });

    it("returns npm when no pnpm-workspace.yaml found", () => {
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
      expect(detectInstallKind()).toBe("npm");
      existsSpy.mockRestore();
    });
  });

  describe("detectPackageManager", () => {
    it("detects bun from exec path", () => {
      const originalArgv = process.argv;
      process.argv = ["node", "/path/.bun/install/bin/tentacle"];
      expect(detectPackageManager()).toBe("bun");
      process.argv = originalArgv;
    });

    it("detects pnpm from exec path", () => {
      const originalArgv = process.argv;
      process.argv = ["node", "/path/pnpm/global/tentacle"];
      expect(detectPackageManager()).toBe("pnpm");
      process.argv = originalArgv;
    });

    it("defaults to npm", () => {
      const originalArgv = process.argv;
      process.argv = ["node", "/usr/bin/tentacle"];
      expect(detectPackageManager()).toBe("npm");
      process.argv = originalArgv;
    });
  });

  describe("fetchLatestVersion", () => {
    it("returns version on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ version: "1.2.3" }),
      } as Response);

      const version = await fetchLatestVersion();
      expect(version).toBe("1.2.3");
    });

    it("returns null on non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const version = await fetchLatestVersion();
      expect(version).toBeNull();
    });

    it("returns null on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

      const version = await fetchLatestVersion();
      expect(version).toBeNull();
    });

    it("fetches beta channel", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ version: "2.0.0-beta" }),
      } as Response);

      const version = await fetchLatestVersion("beta");
      expect(version).toBe("2.0.0-beta");
      const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toContain("/beta");
    });
  });

  describe("getCurrentVersion", () => {
    it("returns version from package.json", () => {
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
      const readSpy = vi
        .spyOn(fs, "readFileSync")
        .mockReturnValue(JSON.stringify({ name: "openoctopus", version: "1.0.0" }));

      expect(getCurrentVersion()).toBe("1.0.0");

      existsSpy.mockRestore();
      readSpy.mockRestore();
    });

    it("returns 0.0.0 when package.json not found", () => {
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
      expect(getCurrentVersion()).toBe("0.0.0");
      existsSpy.mockRestore();
    });

    it("returns 0.0.0 on read error", () => {
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
      const readSpy = vi.spyOn(fs, "readFileSync").mockImplementation(() => {
        throw new Error("read error");
      });

      expect(getCurrentVersion()).toBe("0.0.0");

      existsSpy.mockRestore();
      readSpy.mockRestore();
    });
  });
});
