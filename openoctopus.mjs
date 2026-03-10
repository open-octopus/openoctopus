#!/usr/bin/env node

// OpenOctopus CLI entry point
// Performs Node.js version check, then delegates to the bundled CLI.

const nodeVersion = process.versions.node;
const [major, minor] = nodeVersion.split(".").map(Number);

if (major < 22 || (major === 22 && minor < 12)) {
  process.stderr.write(
    `\nOpenOctopus requires Node.js >= 22.12.0 (current: ${nodeVersion}).\n` +
      `Update Node.js:  nvm install 22 && nvm use 22\n` +
      `            or:  fnm install 22 && fnm use 22\n\n`,
  );
  process.exit(1);
}

// Enable compile cache for faster subsequent startups (Node 22.8+)
if (typeof module !== "undefined" && module.enableCompileCache) {
  module.enableCompileCache();
}

await import("./dist/cli.mjs");
