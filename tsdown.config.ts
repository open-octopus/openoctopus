import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    cli: "packages/tentacle/src/cli.ts",
    gateway: "packages/ink/src/index.ts",
  },
  format: "esm",
  platform: "node",
  target: "es2023",
  clean: true,
  fixedExtension: true,
  dts: false,
  noExternal: [/^@openoctopus\//],
  external: [
    "better-sqlite3",
    "express",
    "ws",
    "grammy",
    "zod",
    "consola",
    "citty",
    "@clack/prompts",
    "picocolors",
    "yaml",
  ],
  env: {
    NODE_ENV: "production",
  },
});
