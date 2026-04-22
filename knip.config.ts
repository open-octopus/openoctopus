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
      ignoreDependencies: ["jsdom"],
    },
  },
  ignore: ["test/**"],
};

export default config;
