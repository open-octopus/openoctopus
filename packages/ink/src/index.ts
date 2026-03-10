export { createServer, type InkServer, type InkServerOptions } from "./server.js";
export type { RpcServices } from "./rpc-handlers.js";

// CLI entry point: `node dist/index.js serve`
const args = process.argv.slice(2);

if (args[0] === "serve") {
  const { createServer } = await import("./server.js");

  const server = await createServer();

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
