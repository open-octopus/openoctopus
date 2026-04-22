import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EntityManager } from "./entity-manager.js";
import { RealmLoader } from "./realm-loader.js";
import type { RealmManager } from "./realm-manager.js";

const { mockParseRealmFileWithBody } = vi.hoisted(() => ({
  mockParseRealmFileWithBody: vi.fn(),
}));

const mockFindByName = vi.fn();
const mockCreateRealm = vi.fn();
const mockUpdateRealm = vi.fn();
const mockFindByNameInRealm = vi.fn();
const mockCreateEntity = vi.fn();

const mockRealmManager = {
  findByName: mockFindByName,
  create: mockCreateRealm,
  update: mockUpdateRealm,
} as unknown as RealmManager;

const mockEntityManager = {
  findByNameInRealm: mockFindByNameInRealm,
  create: mockCreateEntity,
} as unknown as EntityManager;

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("@openoctopus/shared", () => ({
  REALM_CONFIG_FILE: "REALM.md",
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock("./realm-parser.js", () => ({
  parseRealmFileWithBody: mockParseRealmFileWithBody,
}));

import fs from "node:fs";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RealmLoader", () => {
  it("returns 0 when realms directory does not exist", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const loader = new RealmLoader(mockRealmManager, mockEntityManager);
    const count = await loader.loadFromDirectory("/realms");

    expect(count).toBe(0);
  });

  it("seeds a new realm with entities", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockReturnValue([
      { name: "health", isDirectory: () => true },
    ] as any);
    vi.spyOn(fs, "readFileSync").mockReturnValue("---\nname: Health\n---\n# Health Realm");

    mockParseRealmFileWithBody.mockReturnValue({
      realm: {
        name: "Health",
        description: "Health realm",
        icon: "heart",
        defaultEntities: [{ name: "Doctor", type: "living", attributes: {} }],
        skills: ["search"],
        agents: [{ name: "Health Agent", personality: "caring" }],
        proactiveRules: [],
      },
      body: "# Health Realm",
    });

    mockFindByName.mockReturnValue(undefined);
    mockCreateRealm.mockReturnValue({ id: "realm_1", name: "Health" });
    mockFindByNameInRealm.mockReturnValue(undefined);

    const loader = new RealmLoader(mockRealmManager, mockEntityManager);
    const count = await loader.loadFromDirectory("/realms");

    expect(count).toBe(1);
    expect(mockCreateRealm).toHaveBeenCalledWith({
      name: "Health",
      description: "Health realm",
      icon: "heart",
    });
    expect(mockCreateEntity).toHaveBeenCalledWith({
      realmId: "realm_1",
      name: "Doctor",
      type: "living",
      attributes: {},
      soulPath: undefined,
    });
    expect(loader.getRealmAgent("realm_1")).toBeDefined();
  });

  it("updates existing realm instead of creating", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockReturnValue([
      { name: "finance", isDirectory: () => true },
    ] as any);
    vi.spyOn(fs, "readFileSync").mockReturnValue("---\nname: Finance\n---\n");

    mockParseRealmFileWithBody.mockReturnValue({
      realm: {
        name: "Finance",
        description: "Updated desc",
        icon: "dollar",
        defaultEntities: [],
        skills: [],
        agents: [],
        proactiveRules: [],
      },
      body: "",
    });

    const existingRealm = { id: "realm_2", name: "Finance" };
    mockFindByName.mockReturnValue(existingRealm);
    mockUpdateRealm.mockReturnValue({ ...existingRealm, description: "Updated desc" });

    const loader = new RealmLoader(mockRealmManager, mockEntityManager);
    const count = await loader.loadFromDirectory("/realms");

    expect(count).toBe(1);
    expect(mockUpdateRealm).toHaveBeenCalledWith("realm_2", {
      description: "Updated desc",
      icon: "dollar",
    });
    expect(mockCreateRealm).not.toHaveBeenCalled();
  });

  it("skips directories without REALM.md", async () => {
    vi.spyOn(fs, "existsSync").mockImplementation((p: fs.PathLike) => {
      if (typeof p === "string" && p.endsWith("REALM.md")) {
        return false;
      }
      return true;
    });
    vi.spyOn(fs, "readdirSync").mockReturnValue([
      { name: "empty", isDirectory: () => true },
    ] as any);

    const loader = new RealmLoader(mockRealmManager, mockEntityManager);
    const count = await loader.loadFromDirectory("/realms");

    expect(count).toBe(0);
    expect(mockCreateRealm).not.toHaveBeenCalled();
  });

  it("skips non-directory entries", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockReturnValue([
      { name: "README.md", isDirectory: () => false },
    ] as any);

    const loader = new RealmLoader(mockRealmManager, mockEntityManager);
    const count = await loader.loadFromDirectory("/realms");

    expect(count).toBe(0);
  });

  it("handles parse errors gracefully", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockReturnValue([{ name: "bad", isDirectory: () => true }] as any);
    vi.spyOn(fs, "readFileSync").mockReturnValue("---\nname: Bad\n---\n");

    mockParseRealmFileWithBody.mockImplementation(() => {
      throw new Error("YAML parse error");
    });

    const loader = new RealmLoader(mockRealmManager, mockEntityManager);
    const count = await loader.loadFromDirectory("/realms");

    expect(count).toBe(0);
    expect(mockCreateRealm).not.toHaveBeenCalled();
  });

  it("skips existing entities when seeding", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockReturnValue([{ name: "pets", isDirectory: () => true }] as any);
    vi.spyOn(fs, "readFileSync").mockReturnValue("---\nname: Pets\n---\n");

    mockParseRealmFileWithBody.mockReturnValue({
      realm: {
        name: "Pets",
        description: "",
        defaultEntities: [{ name: "Cat", type: "living", attributes: { color: "orange" } }],
        skills: [],
        agents: [],
        proactiveRules: [],
      },
      body: "",
    });

    mockFindByName.mockReturnValue(undefined);
    mockCreateRealm.mockReturnValue({ id: "realm_3", name: "Pets" });
    mockFindByNameInRealm.mockReturnValue({ id: "entity_1", name: "Cat" });

    const loader = new RealmLoader(mockRealmManager, mockEntityManager);
    const count = await loader.loadFromDirectory("/realms");

    expect(count).toBe(1);
    expect(mockCreateEntity).not.toHaveBeenCalled();
  });

  it("returns cached agent meta via getRealmAgent", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockReturnValue([{ name: "work", isDirectory: () => true }] as any);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      "---\nname: Work\nskills:\n  - email\nagents:\n  - name: Work Agent\n    personality: professional\n---\n# Work",
    );

    mockParseRealmFileWithBody.mockReturnValue({
      realm: {
        name: "Work",
        description: "",
        icon: undefined,
        defaultEntities: [],
        skills: ["email"],
        agents: [{ name: "Work Agent", personality: "professional" }],
        proactiveRules: [],
      },
      body: "# Work",
    });

    mockFindByName.mockReturnValue(undefined);
    mockCreateRealm.mockReturnValue({ id: "realm_4", name: "Work" });

    const loader = new RealmLoader(mockRealmManager, mockEntityManager);
    await loader.loadFromDirectory("/realms");

    const meta = loader.getRealmAgent("realm_4");
    expect(meta).toBeDefined();
    expect(meta?.agentConfig.name).toBe("Work Agent");
    expect(meta?.agentConfig.personality).toBe("professional");
    expect(meta?.skills).toEqual(["email"]);
    expect(meta?.systemPrompt).toContain("Work");
    expect(meta?.systemPrompt).toContain("professional");
  });
});
