import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type InstallKind = "git" | "npm";
export type PackageManager = "npm" | "pnpm" | "bun";

/**
 * Detect whether the CLI is running from a git clone or an npm global install.
 */
export function detectInstallKind(): InstallKind {
  // Walk up from this file looking for pnpm-workspace.yaml (git clone indicator)
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return "git";
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return "npm";
}

/**
 * Detect which package manager was used for the global install.
 * Checks the install path for telltale directory names.
 */
export function detectPackageManager(): PackageManager {
  const execPath = process.argv[1] || "";

  if (execPath.includes(".bun")) {
    return "bun";
  }
  if (execPath.includes("/pnpm-global/") || execPath.includes("pnpm/global")) {
    return "pnpm";
  }

  // Default to npm
  return "npm";
}

/**
 * Fetch the latest published version from the npm registry.
 */
export async function fetchLatestVersion(
  channel: "latest" | "beta" = "latest",
): Promise<string | null> {
  const tag = channel === "beta" ? "beta" : "latest";
  const url = `https://registry.npmjs.org/openoctopus/${tag}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the current installed version from the root package.json.
 */
export function getCurrentVersion(): string {
  // Walk up from this file to find the root package.json
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
          name?: string;
          version?: string;
        };
        if (pkg.name === "openoctopus" || pkg.name === "@openoctopus/tentacle") {
          return pkg.version ?? "0.0.0";
        }
      } catch {
        // continue searching
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return "0.0.0";
}
