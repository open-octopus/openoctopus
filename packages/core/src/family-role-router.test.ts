import { describe, it, expect, vi, beforeEach } from "vitest";
import { FamilyRoleRouter } from "./family-role-router.js";

const mockFamilyMemberRepo = {
  list: vi.fn(),
  getById: vi.fn(),
  findByName: vi.fn(),
  findByRole: vi.fn(),
  findByRealm: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createAction: vi.fn(),
  getAction: vi.fn(),
  listPendingActions: vi.fn(),
  updateActionStatus: vi.fn(),
};

const mockRealmManager = {
  get: vi.fn().mockReturnValue({ id: "realm_parents", name: "parents", description: "Parents" }),
  list: vi.fn().mockReturnValue([]),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByName: vi.fn(),
};

const mockLlmRegistry = {
  hasRealProvider: vi.fn().mockReturnValue(false),
  getProvider: vi.fn(),
  resolveModel: vi.fn(),
  listProviders: vi.fn().mockReturnValue([]),
};

describe("FamilyRoleRouter", () => {
  let router: FamilyRoleRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new FamilyRoleRouter(
      mockFamilyMemberRepo as unknown as ConstructorParameters<typeof FamilyRoleRouter>[0],
      mockRealmManager as unknown as ConstructorParameters<typeof FamilyRoleRouter>[1],
      mockLlmRegistry as unknown as ConstructorParameters<typeof FamilyRoleRouter>[2],
    );
  });

  it("returns empty when no family members configured", async () => {
    mockFamilyMemberRepo.list.mockReturnValue([]);
    const result = await router.routeByRole({
      sourceRealmId: "realm_parents",
      message: "grandpa's knee hurts",
      assistantResponse: "That sounds painful",
    });
    expect(result.actions).toHaveLength(0);
    expect(result.reasoning).toContain("No family members");
  });

  it("routes scheduler keywords to members with scheduler role", async () => {
    mockFamilyMemberRepo.list.mockReturnValue([
      { id: "fm_dad", name: "Dad", roles: ["scheduler", "executor"], realmIds: [] },
      { id: "fm_mom", name: "Mom", roles: ["caretaker"], realmIds: [] },
    ]);
    mockFamilyMemberRepo.createAction.mockImplementation((data: Record<string, unknown>) => ({
      id: "action_1",
      ...data,
      status: "pending",
      createdAt: new Date().toISOString(),
    }));

    const result = await router.routeByRole({
      sourceRealmId: "realm_parents",
      message: "need to schedule an appointment for grandpa",
      assistantResponse: "I recommend booking a doctor visit",
    });

    expect(result.actions.length).toBeGreaterThan(0);
    expect(mockFamilyMemberRepo.createAction).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "fm_dad",
        role: "scheduler",
      }),
    );
  });

  it("routes caretaker keywords to members with caretaker role", async () => {
    mockFamilyMemberRepo.list.mockReturnValue([
      { id: "fm_dad", name: "Dad", roles: ["scheduler"], realmIds: [] },
      { id: "fm_mom", name: "Mom", roles: ["caretaker"], realmIds: [] },
    ]);
    mockFamilyMemberRepo.createAction.mockImplementation((data: Record<string, unknown>) => ({
      id: "action_2",
      ...data,
      status: "pending",
      createdAt: new Date().toISOString(),
    }));

    const result = await router.routeByRole({
      sourceRealmId: "realm_parents",
      message: "need to buy medicine for grandpa's knee",
      assistantResponse: "Consider getting pain relief",
    });

    expect(result.actions.length).toBeGreaterThan(0);
    expect(mockFamilyMemberRepo.createAction).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "fm_mom",
        role: "caretaker",
      }),
    );
  });

  it("routes Chinese keywords correctly", async () => {
    mockFamilyMemberRepo.list.mockReturnValue([
      { id: "fm_dad", name: "Dad", roles: ["scheduler"], realmIds: [] },
    ]);
    mockFamilyMemberRepo.createAction.mockImplementation((data: Record<string, unknown>) => ({
      id: "action_3",
      ...data,
      status: "pending",
      createdAt: new Date().toISOString(),
    }));

    const result = await router.routeByRole({
      sourceRealmId: "realm_parents",
      message: "需要预约一下医生",
      assistantResponse: "好的",
    });

    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.reasoning).toContain("scheduler");
  });

  it("returns empty when no role keywords match", async () => {
    mockFamilyMemberRepo.list.mockReturnValue([
      { id: "fm_dad", name: "Dad", roles: ["scheduler"], realmIds: [] },
    ]);

    const result = await router.routeByRole({
      sourceRealmId: "realm_parents",
      message: "hello how are you today",
      assistantResponse: "I'm doing well",
    });

    expect(result.actions).toHaveLength(0);
    expect(result.reasoning).toContain("No role-relevant keywords");
  });

  it("assigns multiple roles from a single message", async () => {
    mockFamilyMemberRepo.list.mockReturnValue([
      { id: "fm_dad", name: "Dad", roles: ["scheduler"], realmIds: [] },
      { id: "fm_mom", name: "Mom", roles: ["caretaker"], realmIds: [] },
    ]);
    mockFamilyMemberRepo.createAction.mockImplementation((data: Record<string, unknown>) => ({
      id: `action_${Math.random()}`,
      ...data,
      status: "pending",
      createdAt: new Date().toISOString(),
    }));

    const result = await router.routeByRole({
      sourceRealmId: "realm_parents",
      message: "schedule a doctor and buy medicine for grandpa",
      assistantResponse: "I recommend both actions",
    });

    // Should match both scheduler (schedule) and caretaker (buy, medicine)
    expect(result.actions.length).toBe(2);
  });
});
