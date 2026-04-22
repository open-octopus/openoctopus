import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSlashCommand } from "./commands.js";
import type { TuiState } from "./state.js";

const mockCall = vi.fn();
const mockClient = {
  call: mockCall,
} as unknown as import("../api-client.js").WsRpcClient;

vi.mock("./renderer.js", () => ({
  renderHelp: () => "HELP",
  renderRealmCards: (realms: unknown[]) => `REALMS:${realms.length}`,
  renderRealmDetail: () => "DETAIL",
  renderEntityList: () => "ENTITIES",
  renderHealthReport: () => "HEALTH",
  renderHealthDashboard: () => "DASHBOARD",
  renderCleanupResult: () => "CLEANED",
  renderDistributionResult: () => "INJECTED",
  renderMaturityScores: () => "MATURITY",
  renderScanResult: () => "SCANNED",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function baseState(): TuiState {
  return { connectionMode: "ws", isStreaming: false };
}

describe("handleSlashCommand", () => {
  it("/help returns help text", async () => {
    const result = await handleSlashCommand("/help", mockClient, baseState());
    expect(result.output).toBe("HELP");
  });

  it("/clear clears screen", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const result = await handleSlashCommand("/clear", mockClient, baseState());
    expect(writeSpy).toHaveBeenCalledWith("\x1b[2J\x1b[H");
    expect(result.output).toBeUndefined();
    writeSpy.mockRestore();
  });

  it("/exit disconnects", async () => {
    const result = await handleSlashCommand("/exit", mockClient, baseState());
    expect(result.stateUpdate).toEqual({ connectionMode: "disconnected" });
  });

  it("/quit disconnects", async () => {
    const result = await handleSlashCommand("/quit", mockClient, baseState());
    expect(result.stateUpdate).toEqual({ connectionMode: "disconnected" });
  });

  it("unknown command returns error", async () => {
    const result = await handleSlashCommand("/unknown", mockClient, baseState());
    expect(result.output).toContain("Unknown command");
  });

  it("/status returns formatted status", async () => {
    mockCall.mockResolvedValue({
      result: {
        realms: 2,
        summoned: 1,
        uptime: 125,
        providers: ["anthropic"],
        channels: [{ name: "telegram", type: "telegram", running: true }],
      },
    });

    const state = { ...baseState(), currentRealm: { id: "r1", name: "Health" } };
    const result = await handleSlashCommand("/status", mockClient, state);

    expect(mockCall).toHaveBeenCalledWith("status.info");
    expect(result.output).toContain("Status:");
    expect(result.output).toContain("Health");
    expect(result.output).toContain("2m 5s");
  });

  it("/status handles error", async () => {
    mockCall.mockRejectedValue(new Error("down"));

    const result = await handleSlashCommand("/status", mockClient, baseState());

    expect(result.output).toContain("Failed to get status");
  });

  it("/realms returns empty message", async () => {
    mockCall.mockResolvedValue({ result: { realms: [] } });

    const result = await handleSlashCommand("/realms", mockClient, baseState());

    expect(result.output).toContain("No realms found");
  });

  it("/realms returns realm cards", async () => {
    mockCall.mockResolvedValue({
      result: { realms: [{ id: "r1", name: "Health", status: "active", entityCount: 3 }] },
    });

    const result = await handleSlashCommand("/realms", mockClient, baseState());

    expect(result.output).toBe("REALMS:1");
  });

  it("/realms handles error", async () => {
    mockCall.mockRejectedValue(new Error("fail"));

    const result = await handleSlashCommand("/realms", mockClient, baseState());

    expect(result.output).toContain("Failed to list realms");
  });

  it("/realm with no arg clears context", async () => {
    const result = await handleSlashCommand("/realm", mockClient, baseState());

    expect(result.stateUpdate).toEqual({ currentRealm: undefined });
    expect(result.output).toContain("cleared");
  });

  it("/realm switches to matched realm", async () => {
    mockCall.mockResolvedValueOnce({
      result: { realms: [{ id: "r1", name: "Health", icon: "heart" }] },
    });
    mockCall.mockResolvedValueOnce({
      result: {
        realm: {
          id: "r1",
          name: "Health",
          icon: "heart",
          description: "Health realm",
          agentName: "Doc",
          skills: ["search"],
          entities: [],
        },
      },
    });

    const result = await handleSlashCommand("/realm Health", mockClient, baseState());

    expect(result.stateUpdate).toEqual({
      currentRealm: { id: "r1", name: "Health", icon: "heart" },
      currentEntity: undefined,
    });
    expect(result.output).toBe("DETAIL");
  });

  it("/realm reports not found", async () => {
    mockCall.mockResolvedValue({
      result: { realms: [{ id: "r1", name: "Health" }] },
    });

    const result = await handleSlashCommand("/realm Missing", mockClient, baseState());

    expect(result.output).toContain("not found");
  });

  it("/entities warns when no realm selected", async () => {
    const result = await handleSlashCommand("/entities", mockClient, baseState());

    expect(result.output).toContain("No realm selected");
  });

  it("/entities lists entities", async () => {
    mockCall.mockResolvedValue({
      result: { entities: [{ id: "e1", name: "Alice", type: "living", summonStatus: "active" }] },
    });

    const state = { ...baseState(), currentRealm: { id: "r1", name: "Health" } };
    const result = await handleSlashCommand("/entities", mockClient, state);

    expect(mockCall).toHaveBeenCalledWith("entity.list", { realmId: "r1" });
    expect(result.output).toBe("ENTITIES");
  });

  it("/summon warns on missing arg", async () => {
    const result = await handleSlashCommand("/summon", mockClient, baseState());

    expect(result.output).toContain("Usage: /summon");
  });

  it("/summon invokes entity", async () => {
    mockCall.mockResolvedValue({
      result: { entity: { id: "e1", name: "Alice" } },
    });

    const result = await handleSlashCommand("/summon e1", mockClient, baseState());

    expect(result.stateUpdate).toEqual({ currentEntity: { id: "e1", name: "Alice" } });
    expect(result.output).toContain("Summoned: Alice");
  });

  it("/summon handles API error", async () => {
    mockCall.mockResolvedValue({ error: { message: "not found" } });

    const result = await handleSlashCommand("/summon e1", mockClient, baseState());

    expect(result.output).toContain("Summon failed: not found");
  });

  it("/release warns when no entity", async () => {
    const result = await handleSlashCommand("/release", mockClient, baseState());

    expect(result.output).toContain("No entity is currently summoned");
  });

  it("/release invokes release", async () => {
    mockCall.mockResolvedValue({ result: {} });

    const state = { ...baseState(), currentEntity: { id: "e1", name: "Alice" } };
    const result = await handleSlashCommand("/release", mockClient, state);

    expect(mockCall).toHaveBeenCalledWith("summon.release", { entityId: "e1" });
    expect(result.stateUpdate).toEqual({ currentEntity: undefined });
    expect(result.output).toContain("Released: Alice");
  });

  it("/health without arg shows dashboard", async () => {
    mockCall.mockResolvedValue({
      result: { reports: [] },
    });

    const result = await handleSlashCommand("/health", mockClient, baseState());

    expect(result.output).toBe("DASHBOARD");
  });

  it("/health with arg shows report", async () => {
    mockCall
      .mockResolvedValueOnce({
        result: { realms: [{ id: "r1", name: "Health" }] },
      })
      .mockResolvedValueOnce({
        result: { report: { score: 80, issues: [] } },
      });

    const result = await handleSlashCommand("/health Health", mockClient, baseState());

    expect(result.output).toBe("HEALTH");
  });

  it("/health handles error", async () => {
    mockCall.mockRejectedValue(new Error("down"));

    const result = await handleSlashCommand("/health", mockClient, baseState());

    expect(result.output).toContain("Health check failed");
  });

  it("/clean warns without realm", async () => {
    const result = await handleSlashCommand("/clean", mockClient, baseState());

    expect(result.output).toContain("Usage: /clean");
  });

  it("/clean cleans realm", async () => {
    mockCall
      .mockResolvedValueOnce({
        result: { realms: [{ id: "r1", name: "Health" }] },
      })
      .mockResolvedValueOnce({
        result: { result: { deduplicatedCount: 1, archivedCount: 2, issuesResolved: 3 } },
      });

    const state = { ...baseState(), currentRealm: { id: "r1", name: "Health" } };
    const result = await handleSlashCommand("/clean", mockClient, state);

    expect(result.output).toBe("CLEANED");
  });

  it("/clean reports not found", async () => {
    mockCall.mockResolvedValue({
      result: { realms: [{ id: "r1", name: "Health" }] },
    });

    const result = await handleSlashCommand("/clean Missing", mockClient, baseState());

    expect(result.output).toContain("not found");
  });

  it("/inject warns on empty text", async () => {
    const result = await handleSlashCommand("/inject", mockClient, baseState());

    expect(result.output).toContain("Usage: /inject");
  });

  it("/inject injects knowledge", async () => {
    mockCall.mockResolvedValue({
      result: { result: { facts: [], realmsAffected: [], memoriesCreated: 1 } },
    });

    const result = await handleSlashCommand("/inject hello world", mockClient, baseState());

    expect(mockCall).toHaveBeenCalledWith("knowledge.inject", { text: "hello world" });
    expect(result.output).toBe("INJECTED");
  });

  it("/maturity with arg shows scores", async () => {
    mockCall
      .mockResolvedValueOnce({
        result: { realms: [{ id: "r1", name: "Health" }] },
      })
      .mockResolvedValueOnce({
        result: {
          scores: [
            {
              entityName: "Alice",
              overall: 80,
              attributeCompleteness: 90,
              memoryDepth: 70,
              interactionFrequency: 60,
              readyToSummon: true,
            },
          ],
        },
      });

    const result = await handleSlashCommand("/maturity Health", mockClient, baseState());

    expect(result.output).toBe("MATURITY");
  });

  it("/maturity without arg shows suggestions", async () => {
    mockCall.mockResolvedValue({
      result: { suggestions: [] },
    });

    const result = await handleSlashCommand("/maturity", mockClient, baseState());

    expect(result.output).toContain("No entities are ready");
  });

  it("/maturity without arg shows suggestions list", async () => {
    mockCall.mockResolvedValue({
      result: {
        suggestions: [
          { entityName: "Alice", realmName: "Health", maturityScore: 85, reason: "Ready" },
        ],
      },
    });

    const result = await handleSlashCommand("/maturity", mockClient, baseState());

    expect(result.output).toContain("Alice");
    expect(result.output).toContain("85/100");
  });

  it("/scan warns on missing path", async () => {
    const result = await handleSlashCommand("/scan", mockClient, baseState());

    expect(result.output).toContain("Usage: /scan");
  });

  it("/scan scans directory", async () => {
    mockCall.mockResolvedValue({
      result: {
        result: {
          filesScanned: 10,
          filesSkipped: 2,
          factsExtracted: 5,
          realmsAffected: ["Health"],
          errors: [],
        },
      },
    });

    const result = await handleSlashCommand("/scan /tmp", mockClient, baseState());

    expect(mockCall).toHaveBeenCalledWith("directory.scan", { path: "/tmp" });
    expect(result.output).toBe("SCANNED");
  });
});
