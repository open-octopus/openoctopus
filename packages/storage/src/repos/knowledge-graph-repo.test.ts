import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../migrations.js";
import { KnowledgeGraphRepo } from "./knowledge-graph-repo.js";

let db: Database.Database;
let repo: KnowledgeGraphRepo;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  repo = new KnowledgeGraphRepo(db);
  // Create a test realm for FK constraints
  db.prepare("INSERT INTO realms (id, name, description) VALUES (?, ?, ?)").run("realm_test", "test", "test realm");
});

afterEach(() => {
  db.close();
});

describe("KnowledgeGraphRepo", () => {
  it("findOrCreateNode creates a new node", () => {
    const node = repo.findOrCreateNode("realm_test", "Luna", "entity");
    expect(node.id).toBeTruthy();
    expect(node.label).toBe("Luna");
    expect(node.type).toBe("entity");
  });

  it("findOrCreateNode returns existing node for same realm+label", () => {
    const node1 = repo.findOrCreateNode("realm_test", "Luna", "entity");
    const node2 = repo.findOrCreateNode("realm_test", "Luna", "entity");
    expect(node1.id).toBe(node2.id);
  });

  it("findOrCreateNode creates different nodes for different labels", () => {
    const n1 = repo.findOrCreateNode("realm_test", "Luna", "entity");
    const n2 = repo.findOrCreateNode("realm_test", "Max", "entity");
    expect(n1.id).not.toBe(n2.id);
  });

  it("findOrCreateNode stores properties", () => {
    const node = repo.findOrCreateNode("realm_test", "Luna", "entity", { entityId: "entity_123" });
    expect(node.properties.entityId).toBe("entity_123");
  });

  it("addEdge creates a relationship between nodes", () => {
    const n1 = repo.findOrCreateNode("realm_test", "Luna", "entity");
    const n2 = repo.findOrCreateNode("realm_test", "mom", "person");
    const edge = repo.addEdge(n1.id, n2.id, "gifted_by");
    expect(edge.id).toBeTruthy();
    expect(edge.type).toBe("gifted_by");
  });

  it("getRelatedNodes returns connected nodes in both directions", () => {
    const n1 = repo.findOrCreateNode("realm_test", "Luna", "entity");
    const n2 = repo.findOrCreateNode("realm_test", "mom", "person");
    const n3 = repo.findOrCreateNode("realm_test", "vet", "place");
    repo.addEdge(n1.id, n2.id, "gifted_by");
    repo.addEdge(n1.id, n3.id, "visits");

    const related = repo.getRelatedNodes(n1.id);
    expect(related.length).toBe(2);
    const labels = related.map(r => r.node.label);
    expect(labels).toContain("mom");
    expect(labels).toContain("vet");
  });

  it("getRelatedNodes returns incoming edges too", () => {
    const n1 = repo.findOrCreateNode("realm_test", "Luna", "entity");
    const n2 = repo.findOrCreateNode("realm_test", "mom", "person");
    repo.addEdge(n2.id, n1.id, "owns");

    const related = repo.getRelatedNodes(n1.id);
    expect(related.length).toBe(1);
    expect(related[0].node.label).toBe("mom");
    expect(related[0].direction).toBe("incoming");
  });

  it("getEntityGraph returns all nodes and edges for a realm", () => {
    const n1 = repo.findOrCreateNode("realm_test", "Luna", "entity");
    const n2 = repo.findOrCreateNode("realm_test", "mom", "person");
    repo.addEdge(n1.id, n2.id, "gifted_by");

    const graph = repo.getEntityGraph("realm_test");
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
  });
});
