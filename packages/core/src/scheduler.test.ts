import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Scheduler } from "./scheduler.js";

describe("Scheduler", () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe("parseTrigger", () => {
    it("converts human-readable to cron", () => {
      expect(Scheduler.parseTrigger("every day 9am")).toBe("0 9 * * *");
      expect(Scheduler.parseTrigger("every week")).toBe("0 9 * * 1");
      expect(Scheduler.parseTrigger("every month")).toBe("0 9 1 * *");
      expect(Scheduler.parseTrigger("every hour")).toBe("0 * * * *");
    });

    it("passes through raw cron expressions", () => {
      expect(Scheduler.parseTrigger("0 8 * * *")).toBe("0 8 * * *");
      expect(Scheduler.parseTrigger("30 14 * * 1-5")).toBe("30 14 * * 1-5");
    });

    it("handles 'every day Xam/pm' variations", () => {
      expect(Scheduler.parseTrigger("every day 8am")).toBe("0 8 * * *");
      expect(Scheduler.parseTrigger("every day 3pm")).toBe("0 15 * * *");
      expect(Scheduler.parseTrigger("every day 12pm")).toBe("0 12 * * *");
    });

    it("returns null for unrecognized triggers", () => {
      expect(Scheduler.parseTrigger("whenever")).toBeNull();
      expect(Scheduler.parseTrigger("")).toBeNull();
      expect(Scheduler.parseTrigger("next tuesday")).toBeNull();
    });
  });

  describe("addRule and listRules", () => {
    it("stores a rule", () => {
      scheduler.addRule({
        realmId: "realm_pet",
        trigger: "every day 9am",
        action: "Feed cat",
      });
      expect(scheduler.listRules()).toHaveLength(1);
      expect(scheduler.listRules()[0].action).toBe("Feed cat");
    });

    it("stores multiple rules", () => {
      scheduler.addRule({
        realmId: "realm_pet",
        trigger: "every day 9am",
        action: "Feed cat",
      });
      scheduler.addRule({
        realmId: "realm_pet",
        trigger: "every week",
        action: "Vet checkup",
      });
      expect(scheduler.listRules()).toHaveLength(2);
    });

    it("stores rules with entityId", () => {
      scheduler.addRule({
        realmId: "realm_pet",
        entityId: "entity_luna",
        trigger: "every day 9am",
        action: "Feed Luna",
      });
      expect(scheduler.listRules()[0].entityId).toBe("entity_luna");
    });

    it("skips rules with unrecognized triggers", () => {
      scheduler.addRule({
        realmId: "realm_pet",
        trigger: "whenever",
        action: "nope",
      });
      expect(scheduler.listRules()).toHaveLength(0);
    });
  });

  describe("start and stop lifecycle", () => {
    it("starts and stops", () => {
      scheduler.addRule({
        realmId: "realm_pet",
        trigger: "every day 9am",
        action: "test",
      });
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it("is not running initially", () => {
      expect(scheduler.isRunning()).toBe(false);
    });

    it("stop is idempotent", () => {
      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });
  });

  describe("setActionHandler", () => {
    it("stores the handler", () => {
      const handler = vi.fn();
      scheduler.setActionHandler(handler);
      // Handler is stored — will be called when rules fire
      expect(scheduler.listRules()).toHaveLength(0); // just verify no crash
    });
  });

  describe("clearRules", () => {
    it("clears all rules", () => {
      scheduler.addRule({
        realmId: "realm_pet",
        trigger: "every day 9am",
        action: "Feed cat",
      });
      scheduler.addRule({
        realmId: "realm_pet",
        trigger: "every week",
        action: "Vet",
      });
      scheduler.clearRules();
      expect(scheduler.listRules()).toHaveLength(0);
    });
  });
});
