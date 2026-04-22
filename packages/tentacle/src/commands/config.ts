import fs from "node:fs";
import {
  resolveConfigPath,
  writeDefaultConfig,
  loadConfig,
  resetConfig,
} from "@openoctopus/shared";
import { defineCommand } from "citty";
import consola from "consola";

export const configInitCommand = defineCommand({
  meta: {
    name: "init",
    description: "Create default config file",
  },
  args: {
    force: {
      type: "boolean",
      description: "Overwrite existing config",
      default: false,
    },
  },
  async run({ args }) {
    const configPath = resolveConfigPath();

    if (fs.existsSync(configPath) && !args.force) {
      consola.warn(`Config already exists at ${configPath}`);
      consola.info("Use --force to overwrite");
      return;
    }

    const path = writeDefaultConfig();
    consola.success(`Created config at ${path}`);
    consola.info("Edit this file to add LLM provider keys and channel tokens");
  },
});

export const configShowCommand = defineCommand({
  meta: {
    name: "show",
    description: "Show current configuration",
  },
  async run() {
    resetConfig();
    const config = loadConfig();
    consola.log(JSON.stringify(config, null, 2));
  },
});

export const configPathCommand = defineCommand({
  meta: {
    name: "path",
    description: "Show config file path",
  },
  async run() {
    consola.log(resolveConfigPath());
  },
});

export const configValidateCommand = defineCommand({
  meta: {
    name: "validate",
    description: "Validate config file",
  },
  async run() {
    const configPath = resolveConfigPath();
    if (!fs.existsSync(configPath)) {
      consola.warn(`No config file at ${configPath}`);
      return;
    }

    try {
      resetConfig();
      const config = loadConfig(configPath);
      consola.success("Config is valid");
      consola.info(`Providers: ${Object.keys(config.llm.providers).join(", ") || "none"}`);
      consola.info(`Channels: ${Object.keys(config.channels).join(", ") || "none"}`);
    } catch (err) {
      consola.error(
        `Config validation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  },
});

export const configCommand = defineCommand({
  meta: {
    name: "config",
    description: "Manage OpenOctopus configuration",
  },
  subCommands: {
    init: configInitCommand,
    show: configShowCommand,
    path: configPathCommand,
    validate: configValidateCommand,
  },
});
