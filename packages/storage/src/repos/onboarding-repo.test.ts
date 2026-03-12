import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../migrations.js";
import { OnboardingRepo } from "./onboarding-repo.js";

let db: Database.Database;
let repo: OnboardingRepo;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  repo = new OnboardingRepo(db);
});

afterEach(() => {
  db.close();
});

describe("OnboardingRepo", () => {
  it("isCompleted returns false initially", () => {
    expect(repo.isCompleted()).toBe(false);
  });

  it("markCompleted then isCompleted", () => {
    repo.markCompleted(["pet", "finance"]);
    expect(repo.isCompleted()).toBe(true);
  });

  it("getState returns defaults initially", () => {
    const state = repo.getState();
    expect(state).toEqual({ completed: false, realmsSeeded: [] });
  });

  it("getState after completion", () => {
    repo.markCompleted(["pet", "finance"]);
    const state = repo.getState();
    expect(state.completed).toBe(true);
    expect(state.completedAt).toBeDefined();
    expect(typeof state.completedAt).toBe("string");
    expect(state.realmsSeeded).toEqual(["pet", "finance"]);
  });

  it("markCompleted is idempotent", () => {
    repo.markCompleted(["pet", "finance"]);
    repo.markCompleted(["pet", "finance"]);
    expect(repo.isCompleted()).toBe(true);
    const state = repo.getState();
    expect(state.completed).toBe(true);
    expect(state.realmsSeeded).toEqual(["pet", "finance"]);
  });
});
