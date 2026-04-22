import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateCommand } from "./update.js";

const {
  mockDetectInstallKind,
  mockDetectPackageManager,
  mockFetchLatestVersion,
  mockGetCurrentVersion,
  mockRunUpdate,
} = vi.hoisted(() => ({
  mockDetectInstallKind: vi.fn(),
  mockDetectPackageManager: vi.fn(),
  mockFetchLatestVersion: vi.fn(),
  mockGetCurrentVersion: vi.fn(),
  mockRunUpdate: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("../infra/update-check.js", () => ({
  detectInstallKind: mockDetectInstallKind,
  detectPackageManager: mockDetectPackageManager,
  fetchLatestVersion: mockFetchLatestVersion,
  getCurrentVersion: mockGetCurrentVersion,
}));

vi.mock("../infra/update-runner.js", () => ({
  runUpdate: mockRunUpdate,
}));

describe("updateCommand", () => {
  it("advises git pull for git installs", async () => {
    mockDetectInstallKind.mockReturnValue("git");

    await (updateCommand.run as any)({ args: { channel: "stable", "dry-run": false } });

    expect(mockDetectInstallKind).toHaveBeenCalled();
    expect(mockFetchLatestVersion).not.toHaveBeenCalled();
  });

  it("reports up to date", async () => {
    mockDetectInstallKind.mockReturnValue("npm");
    mockGetCurrentVersion.mockReturnValue("1.0.0");
    mockFetchLatestVersion.mockResolvedValue("1.0.0");

    await (updateCommand.run as any)({ args: { channel: "stable", "dry-run": false } });

    expect(mockFetchLatestVersion).toHaveBeenCalledWith("latest");
    expect(mockRunUpdate).not.toHaveBeenCalled();
  });

  it("performs dry run without updating", async () => {
    mockDetectInstallKind.mockReturnValue("npm");
    mockGetCurrentVersion.mockReturnValue("1.0.0");
    mockFetchLatestVersion.mockResolvedValue("2.0.0");

    await (updateCommand.run as any)({ args: { channel: "stable", "dry-run": true } });

    expect(mockRunUpdate).not.toHaveBeenCalled();
  });

  it("runs update when newer version exists", async () => {
    mockDetectInstallKind.mockReturnValue("npm");
    mockGetCurrentVersion.mockReturnValue("1.0.0");
    mockFetchLatestVersion.mockResolvedValue("2.0.0");
    mockDetectPackageManager.mockReturnValue("pnpm");
    mockRunUpdate.mockResolvedValue(0);

    await (updateCommand.run as any)({ args: { channel: "stable", "dry-run": false } });

    expect(mockRunUpdate).toHaveBeenCalledWith("pnpm", "openoctopus@2.0.0");
  });

  it("handles network failure fetching version", async () => {
    mockDetectInstallKind.mockReturnValue("npm");
    mockGetCurrentVersion.mockReturnValue("1.0.0");
    mockFetchLatestVersion.mockResolvedValue(null);

    await (updateCommand.run as any)({ args: { channel: "stable", "dry-run": false } });

    expect(mockRunUpdate).not.toHaveBeenCalled();
  });
});
