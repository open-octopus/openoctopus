import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {},
    "packages/storage": {},
    "packages/core": {},
    "packages/summon": {},
    "packages/channels": {},
    "packages/ink": {},
    "packages/tentacle": {},
    "packages/realmhub": {},
    "packages/dashboard": {
      ignoreDependencies: ["@types/testing-library__jest-dom", "jsdom"],
    },
  },
  ignore: ["test/**"],
};

export default config;
