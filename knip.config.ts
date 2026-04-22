import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      ignoreDependencies: ["tsx", "@types/better-sqlite3"],
    },
    "packages/storage": {
      ignoreDependencies: ["@openoctopus/shared"],
    },
    "packages/core": {
      ignoreDependencies: ["@openoctopus/shared", "@openoctopus/storage"],
    },
    "packages/summon": {
      ignoreDependencies: ["@openoctopus/shared", "@openoctopus/core", "@openoctopus/storage"],
    },
    "packages/channels": {
      ignoreDependencies: ["@openoctopus/shared"],
    },
    "packages/ink": {
      ignoreDependencies: [
        "@openoctopus/shared",
        "@openoctopus/core",
        "@openoctopus/storage",
        "@openoctopus/summon",
        "@openoctopus/channels",
      ],
    },
    "packages/tentacle": {
      ignoreDependencies: [
        "@openoctopus/shared",
        "@openoctopus/core",
        "@openoctopus/storage",
        "@openoctopus/ink",
      ],
    },
    "packages/realmhub": {
      ignoreDependencies: ["@openoctopus/shared", "@openoctopus/core"],
    },
    "packages/dashboard": {
      ignoreDependencies: [
        "@openoctopus/shared",
        "autoprefixer",
        "postcss",
        "@types/testing-library__jest-dom",
        "jsdom",
      ],
    },
  },
  ignore: ["**/*.test.ts", "**/*.integration.test.ts", "**/*.e2e.test.ts", "test/**"],
};

export default config;
