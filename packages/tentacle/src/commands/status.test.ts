import { describe, it, expect, vi, beforeEach } from "vitest";
import { statusCommand } from "./status.js";

const mockHealthCheck = vi.fn();
const mockGet = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("../api-client.js", () => ({
  ApiClient: class {
    healthCheck = mockHealthCheck;
    get = mockGet;
  },
}));

describe("statusCommand", () => {
  it("reports running when health check passes", async () => {
    mockHealthCheck.mockResolvedValue(true);
    mockGet.mockResolvedValue({ status: "ok", timestamp: "2024-01-01T00:00:00Z" });

    await (statusCommand.run as any)({ args: {} });

    expect(mockHealthCheck).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith("/healthz");
  });

  it("reports not running when health check fails", async () => {
    mockHealthCheck.mockResolvedValue(false);

    await (statusCommand.run as any)({ args: {} });

    expect(mockHealthCheck).toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("handles health detail failure gracefully", async () => {
    mockHealthCheck.mockResolvedValue(true);
    mockGet.mockRejectedValue(new Error("details failed"));

    await (statusCommand.run as any)({ args: {} });

    expect(mockHealthCheck).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith("/healthz");
  });
});
