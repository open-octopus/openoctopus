import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { EntityNotFoundError } from "@openoctopus/shared";
import { runMigrations } from "../migrations.js";
import { RealmRepo } from "./realm-repo.js";
import { EntityRepo } from "./entity-repo.js";

let db: Database.Database;
let realmRepo: RealmRepo;
let entityRepo: EntityRepo;
let realmId: string;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  realmRepo = new RealmRepo(db);
  entityRepo = new EntityRepo(db);
  realmId = realmRepo.create({ name: "Pet" }).id;
});

afterEach(() => {
  db.close();
});

describe("EntityRepo", () => {
  it("creates and retrieves an entity", () => {
    const entity = entityRepo.create({
      realmId,
      name: "Luna",
      type: "living",
      attributes: { species: "cat", breed: "ragdoll" },
    });
    expect(entity.name).toBe("Luna");
    expect(entity.type).toBe("living");
    expect(entity.summonStatus).toBe("dormant");
    expect(entity.attributes).toEqual({ species: "cat", breed: "ragdoll" });

    const fetched = entityRepo.getById(entity.id);
    expect(fetched.name).toBe("Luna");
  });

  it("lists entities by realm", () => {
    entityRepo.create({ realmId, name: "Luna", type: "living" });
    entityRepo.create({ realmId, name: "Max", type: "living" });
    const entities = entityRepo.listByRealm(realmId);
    expect(entities).toHaveLength(2);
  });

  it("updates summon status", () => {
    const entity = entityRepo.create({ realmId, name: "Luna", type: "living" });
    const updated = entityRepo.updateSummonStatus(entity.id, "active");
    expect(updated.summonStatus).toBe("active");
  });

  it("deletes an entity", () => {
    const entity = entityRepo.create({ realmId, name: "Temp", type: "asset" });
    entityRepo.delete(entity.id);
    expect(() => entityRepo.getById(entity.id)).toThrow(EntityNotFoundError);
  });

  it("cascades on realm delete", () => {
    entityRepo.create({ realmId, name: "Luna", type: "living" });
    realmRepo.delete(realmId);
    const entities = entityRepo.listByRealm(realmId);
    expect(entities).toHaveLength(0);
  });
});
