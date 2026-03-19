#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { chatCommand } from "./commands/chat.js";
import { configCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import { entityCommand } from "./commands/entity.js";
import { realmCommand } from "./commands/realm.js";
import { setupCommand } from "./commands/setup.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { stopCommand } from "./commands/stop.js";
import { updateCommand } from "./commands/update.js";

const main = defineCommand({
  meta: {
    name: "tentacle",
    version: "2026.3.10",
    description: "OpenOctopus CLI — Realm-native personal life assistant",
  },
  subCommands: {
    start: startCommand,
    stop: stopCommand,
    status: statusCommand,
    realm: realmCommand,
    entity: entityCommand,
    chat: chatCommand,
    setup: setupCommand,
    config: configCommand,
    doctor: doctorCommand,
    update: updateCommand,
  },
});

runMain(main);
