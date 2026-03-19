import type { RealmState } from "@openoctopus/shared";
import { createLogger, ConflictError } from "@openoctopus/shared";
import { RealmRepo, AuditRepo } from "@openoctopus/storage";
import type Database from "better-sqlite3";

const log = createLogger("realm-manager");

export class RealmManager {
  private realmRepo: RealmRepo;
  private auditRepo: AuditRepo;

  constructor(db: Database.Database) {
    this.realmRepo = new RealmRepo(db);
    this.auditRepo = new AuditRepo(db);
  }

  list(): RealmState[] {
    return this.realmRepo.list();
  }

  get(id: string): RealmState {
    return this.realmRepo.getById(id);
  }

  findByName(name: string): RealmState | null {
    return this.realmRepo.findByName(name);
  }

  create(data: { name: string; description?: string; icon?: string }): RealmState {
    const existing = this.realmRepo.findByName(data.name);
    if (existing) {
      throw new ConflictError(`Realm "${data.name}" already exists`);
    }

    const realm = this.realmRepo.create(data);
    log.info(`Created realm: ${realm.name} (${realm.id})`);

    this.auditRepo.log({
      realmId: realm.id,
      action: "create",
      resource: "realm",
      resourceId: realm.id,
      details: { name: realm.name },
    });

    return realm;
  }

  update(
    id: string,
    data: Partial<{ name: string; description: string; status: string; icon: string }>,
  ): RealmState {
    const realm = this.realmRepo.update(id, data);
    log.info(`Updated realm: ${realm.name} (${realm.id})`);

    this.auditRepo.log({
      realmId: id,
      action: "update",
      resource: "realm",
      resourceId: id,
      details: data,
    });

    return realm;
  }

  archive(id: string): RealmState {
    return this.update(id, { status: "archived" });
  }

  delete(id: string): void {
    const realm = this.realmRepo.getById(id);
    this.realmRepo.delete(id);
    log.info(`Deleted realm: ${realm.name} (${id})`);

    this.auditRepo.log({
      action: "delete",
      resource: "realm",
      resourceId: id,
      details: { name: realm.name },
    });
  }

  updateHealthScore(id: string, healthScore: number, riskCount?: number): void {
    this.realmRepo.updateHealthScore(id, healthScore, riskCount);
  }
}
