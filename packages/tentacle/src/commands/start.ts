import { defineCommand } from "citty";
import consola from "consola";
import { ApiClient } from "../api-client.js";

export const startCommand = defineCommand({
  meta: {
    name: "start",
    description: "Start the OpenOctopus gateway server",
  },
  args: {
    port: {
      type: "string",
      description: "Port to listen on",
      default: "19790",
    },
  },
  async run({ args }) {
    const port = Number(args.port);
    const client = new ApiClient(port);

    // Check if already running
    const alive = await client.healthCheck();
    if (alive) {
      consola.info(`OpenOctopus is already running on port ${port}`);
      return;
    }

    consola.start("Starting OpenOctopus gateway...");

    try {
      const { createServer } = await import("@openoctopus/ink");
      const server = await createServer({ port });

      consola.success(`OpenOctopus gateway started`);
      consola.info(`  HTTP bridge: http://localhost:${server.httpPort}`);
      consola.info(`  WS RPC:     ws://localhost:${server.wsPort}`);
      consola.info("Press Ctrl+C to stop");

      const shutdown = async () => {
        consola.info("\nShutting down...");
        await server.close();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } catch (err) {
      consola.error("Failed to start:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});
