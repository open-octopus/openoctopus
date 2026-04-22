import { AgentNotFoundError } from "@openoctopus/shared";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../migrations.js";
import { AgentRepo } from "./agent-repo.js";
import { EntityRepo } from "./entity-repo.js";
import { RealmRepo } from "./realm-repo.js";

let db: Database.Database;
let agentRepo: AgentRepo;
let entityRepo: EntityRepo;
let realmRepo: RealmRepo;
let realmId: string;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  agentRepo = new AgentRepo(db);
  entityRepo = new EntityRepo(db);
  realmRepo = new RealmRepo(db);
  realmId = realmRepo.create({ name: "Test" }).id;
});

afterEach(() => {
  db.close();
});

describe("AgentRepo", () => {
  it("creates and retrieves an agent", () => {
    const agent = agentRepo.create({
      realmId,
      tier: "realm",
      name: "Helper",
      model: "claude-sonnet-4-6",
      skills: ["search"],
      proactive: true,
    });
    expect(agent.name).toBe("Helper");
    expect(agent.tier).toBe("realm");
    expect(agent.model).toBe("claude-sonnet-4-6");
    expect(agent.skills).toEqual(["search"]);
    expect(agent.proactive).toBe(true);

    const fetched = agentRepo.getById(agent.id);
    expect(fetched.name).toBe("Helper");
  });

  it("uses default model and skills when omitted", () => {
    const agent = agentRepo.create({
      realmId,
      tier: "central",
      name: "Router",
    });
    expect(agent.model).toBe("claude-sonnet-4-6");
    expect(agent.skills).toEqual([]);
    expect(agent.proactive).toBe(false);
  });

  it("lists agents by realm", () => {
    agentRepo.create({ realmId, tier: "realm", name: "A1" });
    agentRepo.create({ realmId, tier: "realm", name: "A2" });
    const agents = agentRepo.listByRealm(realmId);
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.name)).toEqual(["A1", "A2"]);
  });

  it("lists central agents", () => {
    agentRepo.create({ realmId, tier: "central", name: "Router" });
    agentRepo.create({ realmId, tier: "realm", name: "Helper" });
    const central = agentRepo.listCentral();
    expect(central).toHaveLength(1);
    expect(central[0].name).toBe("Router");
  });

  it("finds agent by entity id", () => {
    const entity = entityRepo.create({ realmId, name: "Ghost", type: "living" });
    const agent = agentRepo.create({
      realmId,
      tier: "summoned",
      name: "Ghost",
      entityId: entity.id,
    });
    const found = agentRepo.findByEntityId(entity.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(agent.id);

    const notFound = agentRepo.findByEntityId("entity_missing");
    expect(notFound).toBeNull();
  });

  it("throws on missing agent", () => {
    expect(() => agentRepo.getById("agent_nonexistent")).toThrow(AgentNotFoundError);
  });

  it("deletes an agent", () => {
    const agent = agentRepo.create({ realmId, tier: "realm", name: "Temp" });
    agentRepo.delete(agent.id);
    expect(() => agentRepo.getById(agent.id)).toThrow(AgentNotFoundError);
  });
});
