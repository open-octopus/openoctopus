import type Database from "better-sqlite3";
import type { Entity } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";
import { EntityRepo, RealmRepo, AuditRepo } from "@openoctopus/storage";

const log = createLogger("entity-manager");

export class EntityManager {
  private entityRepo: EntityRepo;
  private realmRepo: RealmRepo;
  private auditRepo: AuditRepo;

  constructor(db: Database.Database) {
    this.entityRepo = new EntityRepo(db);
    this.realmRepo = new RealmRepo(db);
    this.auditRepo = new AuditRepo(db);
  }

  listByRealm(realmId: string): Entity[] {
    this.realmRepo.getById(realmId); // validates realm exists
    return this.entityRepo.listByRealm(realmId);
  }

  findByNameInRealm(realmId: string, name: string): Entity | null {
    return this.entityRepo.findByNameInRealm(realmId, name);
  }

  countByRealm(realmId: string): number {
    return this.entityRepo.countByRealm(realmId);
  }

  get(id: string): Entity {
    return this.entityRepo.getById(id);
  }

  create(data: {
    realmId: string;
    name: string;
    type: Entity["type"];
    avatar?: string;
    attributes?: Record<string, unknown>;
    soulPath?: string;
  }): Entity {
    this.realmRepo.getById(data.realmId); // validates realm exists

    const entity = this.entityRepo.create(data);
    log.info(`Created entity: ${entity.name} (${entity.id}) in realm ${data.realmId}`);

    this.auditRepo.log({
      realmId: data.realmId,
      action: "create",
      resource: "entity",
      resourceId: entity.id,
      details: { name: entity.name, type: entity.type },
    });

    return entity;
  }

  update(id: string, data: Partial<{
    name: string;
    type: Entity["type"];
    avatar: string;
    attributes: Record<string, unknown>;
  }>): Entity {
    const entity = this.entityRepo.update(id, data);
    log.info(`Updated entity: ${entity.name} (${id})`);

    this.auditRepo.log({
      realmId: entity.realmId,
      action: "update",
      resource: "entity",
      resourceId: id,
      details: data,
    });

    return entity;
  }

  delete(id: string): void {
    const entity = this.entityRepo.getById(id);
    this.entityRepo.delete(id);
    log.info(`Deleted entity: ${entity.name} (${id})`);

    this.auditRepo.log({
      realmId: entity.realmId,
      action: "delete",
      resource: "entity",
      resourceId: id,
      details: { name: entity.name },
    });
  }
}
