import type { RealmState } from "@openoctopus/shared";
import { defineCommand } from "citty";
import consola from "consola";
import { ApiClient } from "../api-client.js";

const listCommand = defineCommand({
  meta: { name: "list", description: "List all realms" },
  async run() {
    const client = new ApiClient();
    const result = await client.get<{ data: RealmState[] }>("/api/realms");
    const realms = result.data;

    if (realms.length === 0) {
      consola.info("No realms found. Create one with: tentacle realm create <name>");
      return;
    }

    consola.info(`Found ${realms.length} realm(s):\n`);
    for (const realm of realms) {
      const status = realm.status === "active" ? "[active]" : `[${realm.status}]`;
      consola.log(`  ${status} ${realm.name} (${realm.id})`);
      if (realm.description) {
        consola.log(`      ${realm.description}`);
      }
    }
  },
});

const createCommand = defineCommand({
  meta: { name: "create", description: "Create a new realm" },
  args: {
    name: {
      type: "positional",
      description: "Realm name",
      required: true,
    },
    description: {
      type: "string",
      description: "Realm description",
      alias: "d",
    },
  },
  async run({ args }) {
    const client = new ApiClient();
    const result = await client.post<{ data: RealmState }>("/api/realms", {
      name: args.name,
      description: args.description,
    });
    consola.success(`Created realm: ${result.data.name} (${result.data.id})`);
  },
});

const infoCommand = defineCommand({
  meta: { name: "info", description: "Show realm details" },
  args: {
    id: {
      type: "positional",
      description: "Realm ID",
      required: true,
    },
  },
  async run({ args }) {
    const client = new ApiClient();
    const result = await client.get<{ data: RealmState }>(`/api/realms/${args.id}`);
    const realm = result.data;

    consola.info(`Realm: ${realm.name}`);
    consola.log(`  ID:          ${realm.id}`);
    consola.log(`  Status:      ${realm.status}`);
    consola.log(`  Health:      ${realm.healthScore}/100`);
    consola.log(`  Description: ${realm.description || "(none)"}`);
    consola.log(`  Created:     ${realm.createdAt}`);
    if (realm.lastActivity) {
      consola.log(`  Last Active: ${realm.lastActivity}`);
    }
  },
});

const archiveCommand = defineCommand({
  meta: { name: "archive", description: "Archive a realm" },
  args: {
    id: {
      type: "positional",
      description: "Realm ID",
      required: true,
    },
  },
  async run({ args }) {
    const client = new ApiClient();
    await client.post(`/api/realms/${args.id}/archive`);
    consola.success(`Realm ${args.id} archived`);
  },
});

export const realmCommand = defineCommand({
  meta: { name: "realm", description: "Manage realms" },
  subCommands: {
    list: listCommand,
    create: createCommand,
    info: infoCommand,
    archive: archiveCommand,
  },
});
