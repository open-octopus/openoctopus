import { describe, it, expect, vi, beforeEach } from "vitest";
import { startCommand } from "./start.js";

const mockCreateServer = vi.fn();
const mockClose = vi.fn();
const mockHealthCheck = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("@openoctopus/ink", () => ({
  createServer: mockCreateServer,
}));

vi.mock("../api-client.js", () => ({
  ApiClient: class {
    healthCheck = mockHealthCheck;
  },
}));

describe("startCommand", () => {
  it("starts server when not running", async () => {
    mockHealthCheck.mockResolvedValue(false);
    mockCreateServer.mockResolvedValue({
      httpPort: 19790,
      wsPort: 19789,
      close: mockClose,
    });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    const onSpy = vi.spyOn(process, "on").mockImplementation(() => process);

    await (startCommand.run as any)({ args: { port: "19790" } });

    expect(mockHealthCheck).toHaveBeenCalled();
    expect(mockCreateServer).toHaveBeenCalledWith({ port: 19790 });
    expect(onSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));

    exitSpy.mockRestore();
    onSpy.mockRestore();
  });

  it("skips start when already running", async () => {
    mockHealthCheck.mockResolvedValue(true);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await (startCommand.run as any)({ args: { port: "19790" } });

    expect(mockHealthCheck).toHaveBeenCalled();
    expect(mockCreateServer).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it("exits on start failure", async () => {
    mockHealthCheck.mockResolvedValue(false);
    mockCreateServer.mockRejectedValue(new Error("port in use"));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit(${code})`);
      });

    await expect((startCommand.run as any)({ args: { port: "19790" } })).rejects.toThrow(
      "process.exit(1)",
    );

    expect(mockCreateServer).toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});
