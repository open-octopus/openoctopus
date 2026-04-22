import fs from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { doctorCommand } from "./doctor.js";

const mockHealthCheck = vi.fn();
const mockTryConnect = vi.fn();
const mockDisconnect = vi.fn();

const { mockResolveConfigPath, mockLoadConfig, mockResetConfig } = vi.hoisted(() => ({
  mockResolveConfigPath: vi.fn().mockReturnValue("/tmp/config.json5"),
  mockLoadConfig: vi.fn().mockReturnValue({
    gateway: { httpPort: 19790, wsPort: 19789 },
    llm: { defaultProvider: "anthropic", providers: { anthropic: { apiKey: "key" } } },
    channels: { telegram: { enabled: true } },
    storage: { dataDir: "/tmp/oo" },
  }),
  mockResetConfig: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
  },
  existsSync: vi.fn(),
}));

vi.mock("@openoctopus/shared", () => ({
  DATA_DIR: ".openoctopus",
  DB_FILE: "db.sqlite",
  resolveConfigPath: mockResolveConfigPath,
  loadConfig: mockLoadConfig,
  resetConfig: mockResetConfig,
}));

vi.mock("../api-client.js", () => ({
  ApiClient: class {
    healthCheck = mockHealthCheck;
  },
  WsRpcClient: class {
    tryConnect = mockTryConnect;
    disconnect = mockDisconnect;
  },
}));

describe("doctorCommand", () => {
  it("passes all checks when healthy", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    mockHealthCheck.mockResolvedValue(true);
    mockTryConnect.mockResolvedValue(true);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await (doctorCommand.run as any)({ args: {} });

    expect(mockResetConfig).toHaveBeenCalled();
    expect(mockHealthCheck).toHaveBeenCalled();
    expect(mockTryConnect).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it("warns when gateway is not running", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    mockHealthCheck.mockResolvedValue(false);
    mockTryConnect.mockResolvedValue(false);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await (doctorCommand.run as any)({ args: {} });

    expect(mockHealthCheck).toHaveBeenCalled();
    expect(mockTryConnect).toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it("warns when config is missing", async () => {
    vi.spyOn(fs, "existsSync").mockImplementation(
      (p: fs.PathLike) => !(typeof p === "string" && p.includes("config")),
    );
    mockHealthCheck.mockResolvedValue(true);
    mockTryConnect.mockResolvedValue(true);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await (doctorCommand.run as any)({ args: {} });

    expect(mockResetConfig).toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});
