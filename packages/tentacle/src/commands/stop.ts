import { defineCommand } from "citty";
import consola from "consola";

export const stopCommand = defineCommand({
  meta: {
    name: "stop",
    description: "Stop the OpenOctopus gateway server",
  },
  async run() {
    consola.info("To stop the server, press Ctrl+C in the terminal where it's running.");
    consola.info(
      "Daemon mode with background process management will be added in a future release.",
    );
  },
});
