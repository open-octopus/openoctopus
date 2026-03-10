import type { RealmPackage } from "@openoctopus/shared";
import { createLogger, ValidationError } from "@openoctopus/shared";

const log = createLogger("realmhub");

export class RealmHubClient {
  async search(_query: string): Promise<RealmPackage[]> {
    log.info("RealmHub search is not yet implemented (Phase 3)");
    return [];
  }

  async install(_packageName: string): Promise<RealmPackage> {
    throw new ValidationError("RealmHub install is not yet implemented (Phase 3)");
  }

  async publish(_pkg: RealmPackage): Promise<void> {
    throw new ValidationError("RealmHub publish is not yet implemented (Phase 3)");
  }
}
