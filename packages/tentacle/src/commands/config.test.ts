import fs from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  configInitCommand,
  configShowCommand,
  configPathCommand,
  configValidateCommand,
} from "./config.js";

beforeEach(() => {
  vi.clearAllMocks();
});

const { mockResolveConfigPath, mockWriteDefaultConfig, mockLoadConfig, mockResetConfig } =
  vi.hoisted(() => ({
    mockResolveConfigPath: vi.fn().mockReturnValue("/tmp/config.json5"),
    mockWriteDefaultConfig: vi.fn().mockReturnValue("/tmp/config.json5"),
    mockLoadConfig: vi.fn().mockReturnValue({
      gateway: { httpPort: 19790, wsPort: 19789 },
      llm: { defaultProvider: "anthropic", providers: {} },
      channels: {},
    }),
    mockResetConfig: vi.fn(),
  }));

vi.mock("@openoctopus/shared", () => ({
  resolveConfigPath: mockResolveConfigPath,
  writeDefaultConfig: mockWriteDefaultConfig,
  loadConfig: mockLoadConfig,
  resetConfig: mockResetConfig,
}));

describe("configCommand", () => {
  describe("init", () => {
    it("creates config when none exists", async () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(false);

      await (configInitCommand.run as any)({ args: { force: false } });

      expect(mockWriteDefaultConfig).toHaveBeenCalled();
    });

    it("warns when config exists without force", async () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      await (configInitCommand.run as any)({ args: { force: false } });

      expect(mockWriteDefaultConfig).not.toHaveBeenCalled();
    });

    it("overwrites config with force flag", async () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      await (configInitCommand.run as any)({ args: { force: true } });

      expect(mockWriteDefaultConfig).toHaveBeenCalled();
    });
  });

  describe("show", () => {
    it("loads and displays config", async () => {
      await (configShowCommand.run as any)({ args: {} });

      expect(mockResetConfig).toHaveBeenCalled();
      expect(mockLoadConfig).toHaveBeenCalled();
    });
  });

  describe("path", () => {
    it("prints config path", async () => {
      await (configPathCommand.run as any)({ args: {} });

      expect(mockResolveConfigPath).toHaveBeenCalled();
    });
  });

  describe("validate", () => {
    it("validates existing config", async () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      await (configValidateCommand.run as any)({ args: {} });

      expect(mockResetConfig).toHaveBeenCalled();
      expect(mockLoadConfig).toHaveBeenCalledWith("/tmp/config.json5");
    });

    it("warns when config file missing", async () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(false);

      await (configValidateCommand.run as any)({ args: {} });

      expect(mockLoadConfig).not.toHaveBeenCalled();
    });
  });
});
