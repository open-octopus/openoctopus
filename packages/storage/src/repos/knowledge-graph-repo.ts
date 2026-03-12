import type Database from "better-sqlite3";
import { generateId } from "@openoctopus/shared";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  realmId: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface RelatedNode {
  node: KnowledgeNode;
  edge: KnowledgeEdge;
  direction: "outgoing" | "incoming";
}

export interface EntityGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

// ────────────────────────────────────────────────────────────────
// Row types (DB shape)
// ────────────────────────────────────────────────────────────────

interface NodeRow {
  id: string;
  realm_id: string;
  label: string;
  type: string;
  properties: string;
  created_at: string;
}

interface EdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties: string;
  created_at: string;
}

// ────────────────────────────────────────────────────────────────
// Converters
// ────────────────────────────────────────────────────────────────

function rowToNode(row: NodeRow): KnowledgeNode {
  return {
    id: row.id,
    realmId: row.realm_id,
    label: row.label,
    type: row.type,
    properties: JSON.parse(row.properties) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function rowToEdge(row: EdgeRow): KnowledgeEdge {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    type: row.type,
    properties: JSON.parse(row.properties) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

// ────────────────────────────────────────────────────────────────
// Repo
// ────────────────────────────────────────────────────────────────

export class KnowledgeGraphRepo {
  constructor(private db: Database.Database) {}

  /**
   * Find a node by realm + label, or create one if it doesn't exist.
   * Provides deduplication — the same label in a realm always resolves to the same node.
   */
  findOrCreateNode(
    realmId: string,
    label: string,
    type: string,
    properties?: Record<string, unknown>,
  ): KnowledgeNode {
    const existing = this.db
      .prepare("SELECT * FROM knowledge_nodes WHERE realm_id = ? AND label = ?")
      .get(realmId, label) as NodeRow | undefined;

    if (existing) {
      return rowToNode(existing);
    }

    const id = generateId("knode");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO knowledge_nodes (id, realm_id, label, type, properties, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, realmId, label, type, JSON.stringify(properties ?? {}), now);

    const inserted = this.db
      .prepare("SELECT * FROM knowledge_nodes WHERE id = ?")
      .get(id) as NodeRow;

    return rowToNode(inserted);
  }

  /**
   * Create an edge (relationship) between two nodes.
   */
  addEdge(
    sourceId: string,
    targetId: string,
    type: string,
    properties?: Record<string, unknown>,
  ): KnowledgeEdge {
    const id = generateId("kedge");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO knowledge_edges (id, source_id, target_id, type, properties, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, sourceId, targetId, type, JSON.stringify(properties ?? {}), now);

    const inserted = this.db
      .prepare("SELECT * FROM knowledge_edges WHERE id = ?")
      .get(id) as EdgeRow;

    return rowToEdge(inserted);
  }

  /**
   * Get all nodes related to a given node (both outgoing and incoming edges).
   */
  getRelatedNodes(nodeId: string): RelatedNode[] {
    const results: RelatedNode[] = [];

    // Outgoing edges: this node is the source
    const outgoingEdges = this.db
      .prepare("SELECT * FROM knowledge_edges WHERE source_id = ?")
      .all(nodeId) as EdgeRow[];

    for (const edgeRow of outgoingEdges) {
      const targetRow = this.db
        .prepare("SELECT * FROM knowledge_nodes WHERE id = ?")
        .get(edgeRow.target_id) as NodeRow | undefined;
      if (targetRow) {
        results.push({
          node: rowToNode(targetRow),
          edge: rowToEdge(edgeRow),
          direction: "outgoing",
        });
      }
    }

    // Incoming edges: this node is the target
    const incomingEdges = this.db
      .prepare("SELECT * FROM knowledge_edges WHERE target_id = ?")
      .all(nodeId) as EdgeRow[];

    for (const edgeRow of incomingEdges) {
      const sourceRow = this.db
        .prepare("SELECT * FROM knowledge_nodes WHERE id = ?")
        .get(edgeRow.source_id) as NodeRow | undefined;
      if (sourceRow) {
        results.push({
          node: rowToNode(sourceRow),
          edge: rowToEdge(edgeRow),
          direction: "incoming",
        });
      }
    }

    return results;
  }

  /**
   * Get the full knowledge graph for a realm — all nodes and edges.
   */
  getEntityGraph(realmId: string): EntityGraph {
    const nodeRows = this.db
      .prepare("SELECT * FROM knowledge_nodes WHERE realm_id = ? ORDER BY label")
      .all(realmId) as NodeRow[];

    const nodes = nodeRows.map(rowToNode);
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Get all edges where both source and target belong to this realm
    const allEdges = this.db
      .prepare(
        `SELECT e.* FROM knowledge_edges e
         JOIN knowledge_nodes s ON e.source_id = s.id
         JOIN knowledge_nodes t ON e.target_id = t.id
         WHERE s.realm_id = ? AND t.realm_id = ?`,
      )
      .all(realmId, realmId) as EdgeRow[];

    const edges = allEdges
      .filter((e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id))
      .map(rowToEdge);

    return { nodes, edges };
  }
}
