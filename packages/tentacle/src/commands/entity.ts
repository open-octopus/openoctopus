import type { Entity } from "@openoctopus/shared";
import { defineCommand } from "citty";
import consola from "consola";
import { ApiClient } from "../api-client.js";

const listCommand = defineCommand({
  meta: { name: "list", description: "List entities in a realm" },
  args: {
    realm: {
      type: "string",
      description: "Realm ID",
      required: true,
      alias: "r",
    },
  },
  async run({ args }) {
    const client = new ApiClient();
    const result = await client.get<{ data: Entity[] }>(`/api/entities?realmId=${args.realm}`);
    const entities = result.data;

    if (entities.length === 0) {
      consola.info("No entities found in this realm.");
      return;
    }

    consola.info(`Found ${entities.length} entity(ies):\n`);
    for (const entity of entities) {
      const summon = entity.summonStatus === "active" ? " [summoned]" : "";
      consola.log(`  [${entity.type}] ${entity.name}${summon} (${entity.id})`);
    }
  },
});

const addCommand = defineCommand({
  meta: { name: "add", description: "Add an entity to a realm" },
  args: {
    name: {
      type: "positional",
      description: "Entity name",
      required: true,
    },
    realm: {
      type: "string",
      description: "Realm ID",
      required: true,
      alias: "r",
    },
    type: {
      type: "string",
      description: "Entity type (living, asset, organization, abstract)",
      default: "living",
      alias: "t",
    },
  },
  async run({ args }) {
    const client = new ApiClient();
    const result = await client.post<{ data: Entity }>("/api/entities", {
      realmId: args.realm,
      name: args.name,
      type: args.type,
    });
    consola.success(`Created entity: ${result.data.name} (${result.data.id})`);
  },
});

const infoCommand = defineCommand({
  meta: { name: "info", description: "Show entity details" },
  args: {
    id: {
      type: "positional",
      description: "Entity ID",
      required: true,
    },
  },
  async run({ args }) {
    const client = new ApiClient();
    const result = await client.get<{ data: Entity }>(`/api/entities/${args.id}`);
    const entity = result.data;

    consola.info(`Entity: ${entity.name}`);
    consola.log(`  ID:      ${entity.id}`);
    consola.log(`  Type:    ${entity.type}`);
    consola.log(`  Realm:   ${entity.realmId}`);
    consola.log(`  Summon:  ${entity.summonStatus}`);
    consola.log(`  Created: ${entity.createdAt}`);
    if (Object.keys(entity.attributes).length > 0) {
      consola.log(`  Attributes: ${JSON.stringify(entity.attributes, null, 2)}`);
    }
  },
});

export const entityCommand = defineCommand({
  meta: { name: "entity", description: "Manage entities" },
  subCommands: {
    list: listCommand,
    add: addCommand,
    info: infoCommand,
  },
});
