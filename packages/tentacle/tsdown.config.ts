import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: "esm",
  platform: "node",
  target: "es2023",
  clean: true,
  fixedExtension: true,
  dts: true,
});
