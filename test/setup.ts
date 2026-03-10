// Global test setup — runs before each test file.
// Matches OpenClaw pattern: process-isolated forks + env/global cleanup.

import { afterEach } from "vitest";

// Ensure no lingering timers leak between tests
afterEach(() => {
  // Clear any mocked timers
  if (typeof globalThis.clearTimeout === "function") {
    // no-op: forks pool handles isolation, but this is a safety net
  }
});
