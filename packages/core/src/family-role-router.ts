import type { FamilyRole, FamilyMember } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";
import type { FamilyMemberRepo, FamilyActionRecord } from "@openoctopus/storage";
import type { LlmProviderRegistry } from "./llm/provider-registry.js";
import type { RealmManager } from "./realm-manager.js";

const log = createLogger("family-role-router");

// Role → action keyword mapping (EN + CN)
const ROLE_KEYWORDS: Record<FamilyRole, string[]> = {
  scheduler: [
    "appointment",
    "schedule",
    "book",
    "reserve",
    "calendar",
    "预约",
    "挂号",
    "安排",
    "日程",
    "预订",
  ],
  caretaker: [
    "buy",
    "prepare",
    "cook",
    "clean",
    "medicine",
    "care",
    "购买",
    "准备",
    "照顾",
    "药",
    "护理",
    "买",
  ],
  executor: [
    "fix",
    "repair",
    "drive",
    "install",
    "move",
    "build",
    "修",
    "修理",
    "开车",
    "安装",
    "搬",
  ],
  observer: [
    "monitor",
    "check",
    "watch",
    "track",
    "observe",
    "report",
    "关注",
    "观察",
    "追踪",
    "注意",
  ],
  coordinator: [
    "organize",
    "plan",
    "coordinate",
    "arrange",
    "communicate",
    "协调",
    "组织",
    "沟通",
    "联系",
    "通知",
  ],
};

export interface RoleRoutingResult {
  actions: FamilyActionRecord[];
  reasoning: string;
}

export class FamilyRoleRouter {
  constructor(
    private familyMemberRepo: FamilyMemberRepo,
    private realmManager: RealmManager,
    private llmRegistry: LlmProviderRegistry,
  ) {}

  /**
   * Analyze a message from a realm and route actionable items to family members
   * based on their roles. E.g. "grandpa's knee hurts" → scheduler: book doctor,
   * caretaker: buy pain relief.
   */
  async routeByRole(params: {
    sourceRealmId: string;
    message: string;
    assistantResponse: string;
  }): Promise<RoleRoutingResult> {
    const { sourceRealmId, message, assistantResponse } = params;
    const members = this.familyMemberRepo.list();

    if (members.length === 0) {
      return { actions: [], reasoning: "No family members configured" };
    }

    // Try LLM-powered routing first, fall back to keyword
    if (this.llmRegistry.hasRealProvider()) {
      return this.routeWithLlm(sourceRealmId, message, assistantResponse, members);
    }

    return this.routeWithKeywords(sourceRealmId, message, members);
  }

  private async routeWithLlm(
    sourceRealmId: string,
    message: string,
    assistantResponse: string,
    members: FamilyMember[],
  ): Promise<RoleRoutingResult> {
    try {
      const provider = this.llmRegistry.getProvider();
      const model = this.llmRegistry.resolveModel();

      const realm = this.realmManager.get(sourceRealmId);
      const memberList = members
        .map((m) => `- ${m.name} (roles: ${m.roles.join(", ")})`)
        .join("\n");

      const result = await provider.chat({
        model,
        messages: [
          {
            role: "user",
            content: `Realm: ${realm.name}
Message: ${message}
Response: ${assistantResponse}

Family members:
${memberList}

Based on this conversation, what actionable tasks should be assigned to which family members based on their roles? Return JSON array:
[{"memberName": "...", "role": "...", "action": "...", "priority": "low|normal|high|urgent"}]
If no actions needed, return [].`,
          },
        ],
        systemPrompt:
          "You are a family task router. Analyze conversations and assign actionable tasks to family members based on their roles. Be specific and practical. Only assign tasks that are clearly implied by the conversation.",
        maxTokens: 500,
        temperature: 0.2,
      });

      const content = result.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return { actions: [], reasoning: "LLM returned no actionable tasks" };
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        memberName: string;
        role: string;
        action: string;
        priority?: string;
      }>;

      const actions: FamilyActionRecord[] = [];
      for (const item of parsed) {
        const member = members.find((m) => m.name.toLowerCase() === item.memberName.toLowerCase());
        if (!member) {
          continue;
        }

        const action = this.familyMemberRepo.createAction({
          memberId: member.id,
          memberName: member.name,
          role: item.role as FamilyRole,
          action: item.action,
          priority: (item.priority as FamilyActionRecord["priority"]) ?? "normal",
          sourceRealmId,
          sourceMessage: message,
        });
        actions.push(action);
      }

      return { actions, reasoning: "LLM-powered role routing" };
    } catch (err) {
      log.warn(
        `LLM role routing failed, falling back to keywords: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.routeWithKeywords(sourceRealmId, message, members);
    }
  }

  private routeWithKeywords(
    sourceRealmId: string,
    message: string,
    members: FamilyMember[],
  ): RoleRoutingResult {
    const lowered = message.toLowerCase();
    const actions: FamilyActionRecord[] = [];
    const matchedRoles = new Set<FamilyRole>();

    // Find which roles are relevant based on keywords in the message
    for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
      for (const kw of keywords) {
        if (lowered.includes(kw)) {
          matchedRoles.add(role as FamilyRole);
          break;
        }
      }
    }

    if (matchedRoles.size === 0) {
      return { actions: [], reasoning: "No role-relevant keywords found" };
    }

    // Assign actions to members who hold the matched roles
    for (const role of matchedRoles) {
      const membersWithRole = members.filter((m) => m.roles.includes(role));
      for (const member of membersWithRole) {
        const action = this.familyMemberRepo.createAction({
          memberId: member.id,
          memberName: member.name,
          role,
          action: `[${role}] Action needed based on: "${message.slice(0, 100)}"`,
          priority: "normal",
          sourceRealmId,
          sourceMessage: message,
        });
        actions.push(action);
      }
    }

    return { actions, reasoning: `Keyword-matched roles: ${[...matchedRoles].join(", ")}` };
  }
}
