import { spawn } from "node:child_process";
import { describe, it, expect, vi } from "vitest";
import { runUpdate } from "./update-runner.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

describe("update-runner", () => {
  it("runs pnpm update and resolves with exit code 0", async () => {
    const mockChild = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === "close") {
          cb(0);
        }
      }),
    };
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

    const code = await runUpdate("pnpm", "openoctopus@latest");
    expect(code).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      "pnpm",
      ["add", "-g", "openoctopus@latest"],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("runs npm update with flags", async () => {
    const mockChild = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === "close") {
          cb(0);
        }
      }),
    };
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

    await runUpdate("npm", "openoctopus");
    expect(spawn).toHaveBeenCalledWith(
      "npm",
      ["i", "-g", "openoctopus", "--no-fund", "--no-audit", "--loglevel=error"],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("runs bun update", async () => {
    const mockChild = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === "close") {
          cb(0);
        }
      }),
    };
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

    await runUpdate("bun", "openoctopus");
    expect(spawn).toHaveBeenCalledWith(
      "bun",
      ["add", "-g", "openoctopus"],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("resolves with code 1 when close code is null", async () => {
    const mockChild = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === "close") {
          cb(null);
        }
      }),
    };
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

    const code = await runUpdate("npm", "openoctopus");
    expect(code).toBe(1);
  });

  it("rejects on spawn error", async () => {
    const mockChild = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === "error") {
          cb(new Error("spawn failed"));
        }
      }),
    };
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

    await expect(runUpdate("npm", "openoctopus")).rejects.toThrow("spawn failed");
  });
});
