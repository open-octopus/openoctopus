import { spawn } from "node:child_process";
import type { PackageManager } from "./update-check.js";

/**
 * Build the CLI arguments for a global install of the given package spec.
 */
export function globalInstallArgs(
  manager: PackageManager,
  spec: string,
): { cmd: string; args: string[] } {
  switch (manager) {
    case "pnpm":
      return { cmd: "pnpm", args: ["add", "-g", spec] };
    case "bun":
      return { cmd: "bun", args: ["add", "-g", spec] };
    case "npm":
    default:
      return {
        cmd: "npm",
        args: ["i", "-g", spec, "--no-fund", "--no-audit", "--loglevel=error"],
      };
  }
}

/**
 * Run a global install as a child process, streaming output to the console.
 * Resolves with the exit code.
 */
export function runUpdate(manager: PackageManager, spec: string): Promise<number> {
  const { cmd, args } = globalInstallArgs(manager, spec);

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
