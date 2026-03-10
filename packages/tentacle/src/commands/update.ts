import { defineCommand } from "citty";
import consola from "consola";
import {
  detectInstallKind,
  detectPackageManager,
  fetchLatestVersion,
  getCurrentVersion,
} from "../infra/update-check.js";
import { runUpdate } from "../infra/update-runner.js";

export const updateCommand = defineCommand({
  meta: {
    name: "update",
    description: "Update OpenOctopus to the latest version",
  },
  args: {
    channel: {
      type: "string",
      description: "Release channel (stable or beta)",
      default: "stable",
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would change without updating",
      default: false,
    },
  },
  async run({ args }) {
    const installKind = detectInstallKind();

    if (installKind === "git") {
      consola.info("Git clone detected. Update with:");
      consola.log("  git pull && pnpm install && pnpm build");
      return;
    }

    const current = getCurrentVersion();
    const channel = args.channel === "beta" ? "beta" : "latest";

    consola.start(`Checking for updates (channel: ${channel})...`);

    const latest = await fetchLatestVersion(channel === "beta" ? "beta" : "latest");

    if (!latest) {
      consola.warn("Could not reach the npm registry. Check your network and try again.");
      return;
    }

    if (latest === current) {
      consola.success(`Already up to date (${current})`);
      return;
    }

    consola.info(`Current: ${current}`);
    consola.info(`Latest:  ${latest}`);

    if (args["dry-run"]) {
      consola.info("Dry run — no changes made.");
      return;
    }

    const manager = detectPackageManager();
    const spec = `openoctopus@${latest}`;

    consola.start(`Updating via ${manager}...`);

    const code = await runUpdate(manager, spec);

    if (code === 0) {
      consola.success(`Updated to ${latest}`);
    } else {
      consola.error(`Update failed (exit code ${code}). Try manually: ${manager} i -g ${spec}`);
      process.exit(1);
    }
  },
});
