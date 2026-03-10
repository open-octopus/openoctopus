import { defineCommand } from "citty";
import consola from "consola";
import { ApiClient } from "../api-client.js";

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Check the status of the OpenOctopus gateway",
  },
  async run() {
    const client = new ApiClient();
    const alive = await client.healthCheck();

    if (alive) {
      consola.success("OpenOctopus is running");
      try {
        const health = await client.get<{ status: string; timestamp: string }>("/healthz");
        consola.info(`  Status: ${health.status}`);
        consola.info(`  Time:   ${health.timestamp}`);
      } catch {
        // health check passed but details failed - still running
      }
    } else {
      consola.warn("OpenOctopus is not running");
      consola.info('Run "tentacle start" to start the gateway');
    }
  },
});
