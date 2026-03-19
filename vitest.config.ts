import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

const packages = path.resolve(import.meta.dirname, "packages");

const isCI = !!process.env.CI;
const cpuCount = os.cpus().length;

export default defineConfig({
  resolve: {
    conditions: ["default"],
    alias: {
      "@openoctopus/shared": path.join(packages, "shared/src/index.ts"),
      "@openoctopus/storage": path.join(packages, "storage/src/index.ts"),
      "@openoctopus/core": path.join(packages, "core/src/index.ts"),
      "@openoctopus/summon": path.join(packages, "summon/src/index.ts"),
      "@openoctopus/channels": path.join(packages, "channels/src/index.ts"),
      "@openoctopus/ink": path.join(packages, "ink/src/index.ts"),
      "@openoctopus/tentacle": path.join(packages, "tentacle/src/index.ts"),
      "@openoctopus/realmhub": path.join(packages, "realmhub/src/index.ts"),
    },
  },
  test: {
    pool: "forks",
    maxWorkers: isCI ? 2 : Math.max(4, Math.min(16, cpuCount)),
    unstubEnvs: true,
    unstubGlobals: true,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    setupFiles: ["test/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["packages/*/src/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts", "**/*.e2e.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["packages/*/src/**/*.integration.test.ts"],
          exclude: ["**/*.e2e.test.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.integration.test.ts",
        "**/*.e2e.test.ts",
        "**/index.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 55,
      },
    },
  },
});
