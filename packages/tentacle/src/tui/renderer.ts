import pc from "picocolors";
import stringWidth from "string-width";
import type { TuiState, RealmSummary } from "./state.js";

// ── Visual width helpers ──

/** Visual width in terminal cells (handles ANSI, emoji, CJK correctly) */
function visWidth(str: string): number {
  return stringWidth(str);
}

function termWidth(): number {
  return process.stdout.columns || 80;
}

/** Pad string to exact visual width */
function vPad(str: string, width: number): string {
  const gap = Math.max(0, width - visWidth(str));
  return str + " ".repeat(gap);
}

/** Truncate to fit visual width */
function vTruncate(str: string, maxW: number): string {
  if (visWidth(str) <= maxW) { return str; }
  // Build up character-by-character until we'd exceed maxW - 1 (room for ellipsis)
  let result = "";
  for (const ch of str) {
    const next = result + ch;
    if (stringWidth(next) > maxW - 1) { break; }
    result = next;
  }
  return result + "\u2026";
}

// ── Card rendering ──

const CARD_W = 22; // inner content width (total = CARD_W + 2 borders)
const CARD_GAP = 1;

function renderSingleCard(r: RealmSummary): string[] {
  const iw = CARD_W;
  const icon = r.icon ?? "\u25CB";
  const status = r.status === "active" ? pc.green("\u25CF") : pc.dim("\u25CB");
  const statusText = r.status === "active" ? pc.green("active") : pc.dim("paused");
  const entLabel = r.entityCount === 1 ? "1 entity" : `${r.entityCount} entities`;
  const agent = vTruncate(r.agentName ?? "Agent", iw - 2);
  const name = vTruncate(r.name, iw - 2);

  const lines: string[] = [];

  // Top border — icon sits outside the box on the border line
  // This avoids emoji width issues: icon is decorative, not part of alignment
  lines.push(pc.dim("\u256D\u2500") + ` ${icon} ` + pc.dim("\u2500".repeat(Math.max(0, iw - 4)) + "\u256E"));

  // Name row (bold, no emoji — pure ASCII alignment)
  lines.push(pc.dim("\u2502") + " " + vPad(pc.bold(name), iw - 1) + pc.dim("\u2502"));

  // Separator
  lines.push(pc.dim("\u2502") + " " + pc.dim("\u2504".repeat(iw - 2)) + " " + pc.dim("\u2502"));

  // Entity count
  lines.push(pc.dim("\u2502") + " " + vPad(pc.dim(entLabel), iw - 1) + pc.dim("\u2502"));

  // Agent name
  lines.push(pc.dim("\u2502") + " " + vPad(pc.cyan(agent), iw - 1) + pc.dim("\u2502"));

  // Status
  lines.push(pc.dim("\u2502") + " " + vPad(`${status} ${statusText}`, iw - 1) + pc.dim("\u2502"));

  // Bottom border
  lines.push(pc.dim("\u2570" + "\u2500".repeat(iw) + "\u256F"));

  return lines;
}

function mergeCardRows(cards: string[][]): string[] {
  if (cards.length === 0) { return []; }
  const height = cards[0].length;
  const merged: string[] = [];
  const gap = " ".repeat(CARD_GAP);
  for (let row = 0; row < height; row++) {
    merged.push("  " + cards.map((c) => c[row]).join(gap));
  }
  return merged;
}

function buildCardGrid(realms: RealmSummary[]): string[] {
  const tw = termWidth();
  const fullCardW = CARD_W + 2; // inner + borders
  const cols = Math.max(1, Math.min(6, Math.floor((tw - 2 + CARD_GAP) / (fullCardW + CARD_GAP))));

  const lines: string[] = [];
  for (let i = 0; i < realms.length; i += cols) {
    const batch = realms.slice(i, i + cols);
    const cards = batch.map(renderSingleCard);
    lines.push(...mergeCardRows(cards));
  }
  return lines;
}

// ── Status bar ──

export function renderStatusBar(state: TuiState): string {
  const parts: string[] = [];

  parts.push(state.connectionMode === "ws" ? pc.green("ws") : state.connectionMode === "http" ? pc.yellow("http") : pc.red("disconnected"));

  if (state.currentEntity) {
    parts.push(pc.magenta(`entity:${state.currentEntity.name}`));
  } else if (state.currentRealm) {
    const icon = state.currentRealm.icon ? `${state.currentRealm.icon} ` : "";
    parts.push(pc.blue(`${icon}${state.currentRealm.name}`));
  } else {
    parts.push(pc.dim("auto-routing"));
  }

  if (state.sessionId) {
    parts.push(pc.dim(`session:${state.sessionId.slice(0, 12)}`));
  }

  return pc.dim("\u2500\u2500 ") + parts.join(pc.dim(" \u2502 ")) + pc.dim(" \u2500\u2500");
}

// ── Messages ──

export function renderMessage(role: "user" | "assistant" | "error" | "system", content: string): string {
  switch (role) {
    case "user":
      return pc.dim("you> ") + content;
    case "assistant":
      return pc.cyan("assistant> ") + content;
    case "error":
      return pc.red("error> ") + content;
    case "system":
      return pc.yellow(content);
  }
}

// ── Thinking spinner ──

const thinkingFrames = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
let thinkingInterval: ReturnType<typeof setInterval> | undefined;

export function showThinking(): void {
  let i = 0;
  thinkingInterval = setInterval(() => {
    process.stdout.write(`\r${pc.cyan(thinkingFrames[i % thinkingFrames.length])} ${pc.dim("thinking...")}`);
    i++;
  }, 80);
}

export function clearThinking(): void {
  if (thinkingInterval) {
    clearInterval(thinkingInterval);
    thinkingInterval = undefined;
    process.stdout.write("\r\x1b[K");
  }
}

// ── Help ──

export function renderHelp(): string {
  const commands = [
    ["/realm [name]", "Switch realm context"],
    ["/realms", "List all realms"],
    ["/entities", "List entities in current realm"],
    ["/summon <id>", "Summon an entity"],
    ["/release", "Release summoned entity"],
    ["/health [realm]", "Show knowledge health scores"],
    ["/clean [realm]", "Clean up realm knowledge"],
    ["/inject <text>", "Inject knowledge from text"],
    ["/maturity [realm]", "Show entity maturity scores"],
    ["/scan <path>", "Scan directory for knowledge"],
    ["/status", "Show connection info"],
    ["/clear", "Clear screen"],
    ["/help", "Show this help"],
    ["/exit", "Quit"],
  ];

  const lines = [pc.bold("Commands:")];
  for (const [cmd, desc] of commands) {
    lines.push(`  ${pc.cyan(cmd.padEnd(18))} ${pc.dim(desc)}`);
  }
  return lines.join("\n");
}

// ── Welcome Dashboard ──

export function renderWelcomeDashboard(realms: RealmSummary[]): string {
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(`  \u{1F419} ${pc.bold("O P E N O C T O P U S")}  ${pc.dim("\u2500".repeat(20))}`);
  lines.push(`     ${pc.dim("Your Life Assistant")}  ${pc.dim(`\u2022 ${realms.length} realms`)}`);
  lines.push("");

  // Card grid
  if (realms.length > 0) {
    lines.push(...buildCardGrid(realms));
    lines.push("");
  }

  // Tip
  lines.push(`  ${pc.dim("\u{1F4A1}")} ${pc.dim("/realm <name>")} to focus, or just chat!`);
  lines.push("");

  return lines.join("\n");
}

// ── Realm Cards (for /realms command) ──

export function renderRealmCards(realms: RealmSummary[]): string {
  if (realms.length === 0) {
    return pc.dim("No realms found.");
  }

  const lines: string[] = [];
  lines.push(pc.bold("  Realms:"));
  lines.push("");
  lines.push(...buildCardGrid(realms));
  return lines.join("\n");
}

// ── Realm Detail (for /realm <name>) ──

export interface RealmDetail {
  name: string;
  icon?: string;
  description?: string;
  agentName?: string;
  skills: string[];
  entities: Array<{ id: string; name: string; type: string; summonStatus: string }>;
}

export function renderRealmDetail(detail: RealmDetail): string {
  const icon = detail.icon ?? "";
  const tw = Math.min(termWidth() - 4, 56);
  const lines: string[] = [];

  // Top — icon on border line to avoid width issues
  lines.push(pc.dim("  \u256D\u2500") + ` ${icon} ` + pc.dim("\u2500".repeat(Math.max(0, tw - 4)) + "\u256E"));

  // Title (no emoji — pure text alignment)
  lines.push(pc.dim("  \u2502") + " " + vPad(pc.bold(detail.name), tw - 1) + pc.dim("\u2502"));

  // Description
  if (detail.description) {
    lines.push(pc.dim("  \u2502") + " " + vPad(pc.dim(vTruncate(detail.description, tw - 2)), tw - 1) + pc.dim("\u2502"));
  }

  // Separator
  lines.push(pc.dim("  \u251C" + "\u2500".repeat(tw) + "\u2524"));

  // Agent
  if (detail.agentName) {
    lines.push(pc.dim("  \u2502") + " " + vPad(`${pc.dim("\u25B8")} ${pc.cyan(detail.agentName)}`, tw - 1) + pc.dim("\u2502"));
  }

  // Skills
  if (detail.skills.length > 0) {
    const skillStr = vTruncate(detail.skills.join(", "), tw - 6);
    lines.push(pc.dim("  \u2502") + " " + vPad(`${pc.dim("\u25B8")} ${pc.dim(skillStr)}`, tw - 1) + pc.dim("\u2502"));
  }

  // Entities
  if (detail.entities.length > 0) {
    lines.push(pc.dim("  \u2502") + " ".repeat(tw) + " " + pc.dim("\u2502"));
    lines.push(pc.dim("  \u2502") + " " + vPad(pc.bold("Entities:"), tw - 1) + pc.dim("\u2502"));
    for (const e of detail.entities) {
      const typeMarker = ({ living: pc.green("\u25CF"), asset: pc.yellow("\u25CF"), organization: pc.blue("\u25CF"), abstract: pc.dim("\u25CF") } as Record<string, string>)[e.type] ?? pc.dim("\u25CB");
      const summon = e.summonStatus === "active" ? pc.green(" *") : "";
      const entityStr = `  ${typeMarker} ${e.name} ${pc.dim(`[${e.type}]`)}${summon}`;
      lines.push(pc.dim("  \u2502") + " " + vPad(entityStr, tw - 1) + pc.dim("\u2502"));
    }
  }

  // Bottom
  lines.push(pc.dim("  \u2570" + "\u2500".repeat(tw) + "\u256F"));

  return lines.join("\n");
}

// ── Health Report ──

export interface HealthReportData {
  realmId: string;
  realmName: string;
  healthScore: number;
  memoryCount: number;
  entityCount: number;
  duplicateCount: number;
  staleCount: number;
  contradictionCount: number;
  issues: Array<{ kind: string; description: string; suggestion: string }>;
  computedAt: string;
}

function healthIcon(score: number): string {
  if (score >= 80) return pc.green("\u2705");
  if (score >= 50) return pc.yellow("\u26A0\uFE0F");
  if (score >= 20) return pc.red("\u274C");
  return "\u{1F4A4}";
}

export function renderHealthReport(report: HealthReportData): string {
  const lines: string[] = [];
  lines.push(pc.bold(`Health Report: ${report.realmName} ${healthIcon(report.healthScore)}`));
  lines.push(`  Score:          ${pc.bold(String(report.healthScore))}/100`);
  lines.push(`  Memories:       ${report.memoryCount}`);
  lines.push(`  Entities:       ${report.entityCount}`);
  lines.push(`  Duplicates:     ${report.duplicateCount}`);
  lines.push(`  Stale:          ${report.staleCount}`);
  lines.push(`  Contradictions: ${report.contradictionCount}`);

  if (report.issues.length > 0) {
    lines.push("");
    lines.push(pc.bold("  Issues:"));
    for (const issue of report.issues) {
      lines.push(`    ${pc.yellow("\u25B8")} [${issue.kind}] ${issue.description}`);
      lines.push(`      ${pc.dim(issue.suggestion)}`);
    }
  }

  return lines.join("\n");
}

export function renderHealthDashboard(reports: HealthReportData[]): string {
  if (reports.length === 0) return pc.dim("No realms to report on.");

  const lines: string[] = [];
  lines.push(pc.bold("  Knowledge Health Report"));

  const overall = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + r.healthScore, 0) / reports.length)
    : 0;

  for (const r of reports) {
    const bar = healthIcon(r.healthScore);
    const score = String(r.healthScore).padStart(3);
    lines.push(`  ${bar} ${pc.bold(r.realmName.padEnd(14))} ${score}/100  ${pc.dim(`${r.memoryCount} memories`)}`);
  }

  lines.push(`  ${pc.dim("Overall:")} ${pc.bold(String(overall))}/100`);
  return lines.join("\n");
}

export function renderCleanupResult(result: { deduplicatedCount: number; archivedCount: number; issuesResolved: number }): string {
  const lines: string[] = [];
  lines.push(pc.bold("Cleanup Result:"));
  lines.push(`  Deduplicated: ${result.deduplicatedCount}`);
  lines.push(`  Archived:     ${result.archivedCount}`);
  lines.push(`  Resolved:     ${result.issuesResolved} issues`);
  return lines.join("\n");
}

// ── Distribution Result ──

export function renderDistributionResult(result: {
  facts: Array<{ content: string; realmName: string; entityName?: string }>;
  realmsAffected: string[];
  memoriesCreated: number;
}): string {
  if (result.memoriesCreated === 0) {
    return pc.yellow("No facts extracted from input.");
  }

  const lines: string[] = [];
  lines.push(pc.bold(`Injected ${result.memoriesCreated} facts into ${result.realmsAffected.length} realm(s):`));

  for (const fact of result.facts) {
    const entity = fact.entityName ? pc.magenta(` [${fact.entityName}]`) : "";
    lines.push(`  ${pc.blue(fact.realmName)}${entity} ${pc.dim("\u2192")} ${fact.content}`);
  }

  return lines.join("\n");
}

// ── Maturity Scores ──

export function renderMaturityScores(scores: Array<{
  entityName: string;
  overall: number;
  attributeCompleteness: number;
  memoryDepth: number;
  interactionFrequency: number;
  readyToSummon: boolean;
}>, realmName?: string): string {
  if (scores.length === 0) {
    return pc.dim("No entities found to evaluate.");
  }

  const lines: string[] = [];
  lines.push(pc.bold(`Entity Maturity${realmName ? ` (${realmName})` : ""}:`));

  for (const s of scores) {
    const ready = s.readyToSummon ? pc.green(" \u2713 ready") : "";
    lines.push(`  ${pc.magenta(s.entityName.padEnd(16))} ${String(s.overall).padStart(3)}/100${ready}`);
    lines.push(`    ${pc.dim(`attrs: ${s.attributeCompleteness}%  memory: ${s.memoryDepth}%  interaction: ${s.interactionFrequency}%`)}`);
  }

  return lines.join("\n");
}

export function renderSummonSuggestion(suggestion: {
  entityName: string;
  realmName: string;
  maturityScore: number;
  entityId: string;
}): string {
  return pc.cyan(`  \u{1F4A1} ${suggestion.entityName} (${suggestion.realmName}) is ready to be summoned! Score: ${suggestion.maturityScore}/100\n     Use /summon ${suggestion.entityId} to activate.`);
}

// ── Scan Result ──

export function renderScanResult(result: {
  filesScanned: number;
  filesSkipped: number;
  factsExtracted: number;
  realmsAffected: string[];
  errors: string[];
}): string {
  const lines: string[] = [];
  lines.push(pc.bold("Directory Scan Complete:"));
  lines.push(`  Files scanned:  ${result.filesScanned}`);
  lines.push(`  Files skipped:  ${result.filesSkipped}`);
  lines.push(`  Facts extracted: ${result.factsExtracted}`);

  if (result.realmsAffected.length > 0) {
    lines.push(`  Realms affected: ${result.realmsAffected.join(", ")}`);
  }

  if (result.errors.length > 0) {
    lines.push("");
    lines.push(pc.yellow("  Errors:"));
    for (const err of result.errors.slice(0, 5)) {
      lines.push(`    ${pc.red("\u25B8")} ${err}`);
    }
    if (result.errors.length > 5) {
      lines.push(pc.dim(`    ...and ${result.errors.length - 5} more`));
    }
  }

  return lines.join("\n");
}

// ── Entity List ──

export function renderEntityList(
  entities: Array<{ id: string; name: string; type: string; summonStatus: string }>,
  realmName: string,
): string {
  if (entities.length === 0) {
    return pc.dim("No entities in this realm.");
  }

  const typeMarkers: Record<string, string> = {
    living: pc.green("\u25CF"),
    asset: pc.yellow("\u25CF"),
    organization: pc.blue("\u25CF"),
    abstract: pc.dim("\u25CF"),
  };

  const lines = [pc.bold(`Entities in ${realmName}:`)];
  for (const e of entities) {
    const marker = typeMarkers[e.type] ?? pc.dim("\u25CB");
    const summon = e.summonStatus === "active" ? pc.green(" * summoned") : "";
    lines.push(`  ${marker} ${pc.magenta(e.name)} ${pc.dim(`[${e.type}]`)}${summon} ${pc.dim(`(${e.id.slice(0, 12)}...)`)}`);
  }
  return lines.join("\n");
}
