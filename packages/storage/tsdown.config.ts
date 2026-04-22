import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "es2023",
  clean: true,
  fixedExtension: true,
  dts: true,
  deps: {
    neverBundle: ["better-sqlite3"],
  },
});
