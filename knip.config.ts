import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: ["packages/*/src/index.ts"],
      ignoreDependencies: ["tsx", "@types/better-sqlite3", "@types/express", "@types/ws"],
    },
    "packages/shared": {
      entry: ["src/index.ts"],
    },
    "packages/storage": {
      entry: ["src/index.ts"],
      ignoreDependencies: ["@openoctopus/shared"],
    },
    "packages/core": {
      entry: ["src/index.ts"],
      ignoreDependencies: ["@openoctopus/shared", "@openoctopus/storage"],
    },
    "packages/summon": {
      entry: ["src/index.ts"],
      ignoreDependencies: ["@openoctopus/shared", "@openoctopus/core", "@openoctopus/storage"],
    },
    "packages/channels": {
      entry: ["src/index.ts"],
      ignoreDependencies: ["@openoctopus/shared"],
    },
    "packages/ink": {
      entry: ["src/index.ts"],
      ignoreDependencies: [
        "@openoctopus/shared",
        "@openoctopus/core",
        "@openoctopus/storage",
        "@openoctopus/summon",
        "@openoctopus/channels",
      ],
    },
    "packages/tentacle": {
      entry: ["src/index.ts", "src/cli.ts"],
      ignoreDependencies: [
        "@openoctopus/shared",
        "@openoctopus/core",
        "@openoctopus/storage",
        "@openoctopus/ink",
      ],
    },
    "packages/realmhub": {
      entry: ["src/index.ts"],
      ignoreDependencies: ["@openoctopus/shared", "@openoctopus/core"],
    },
    "packages/dashboard": {
      entry: ["src/main.tsx"],
      ignoreDependencies: ["@openoctopus/shared", "autoprefixer", "postcss"],
    },
  },
  ignore: ["**/*.test.ts", "**/*.integration.test.ts", "**/*.e2e.test.ts", "test/**"],
};

export default config;
