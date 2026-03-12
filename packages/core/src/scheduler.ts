import { createLogger } from "@openoctopus/shared";

const log = createLogger("scheduler");

export interface SchedulerRule {
  realmId: string;
  entityId?: string;
  trigger: string;
  action: string;
  cronExpression: string;
}

type ActionHandler = (rule: SchedulerRule) => void | Promise<void>;

/** Map human-readable triggers to cron expressions */
const TRIGGER_MAP: Record<string, string> = {
  "every hour": "0 * * * *",
  "every day": "0 9 * * *",
  "every week": "0 9 * * 1",
  "every month": "0 9 1 * *",
};

/** Simple cron expression validator (5-field format) */
const CRON_REGEX =
  /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/;

/** Match "every day Xam" or "every day Xpm" */
const TIME_REGEX = /^every\s+day\s+(\d{1,2})(am|pm)$/i;

/** Convert cron expression to milliseconds interval (MVP approximation) */
function cronToInterval(cron: string): number {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return 24 * 60 * 60 * 1000; // default: daily

  const [_minute, hour, dayOfMonth, , dayOfWeek] = parts;

  // "0 * * * *" → hourly
  if (hour === "*") return 60 * 60 * 1000;

  // "0 9 * * 1" → weekly (day of week specified)
  if (dayOfWeek !== "*") return 7 * 24 * 60 * 60 * 1000;

  // "0 9 1 * *" → monthly (day of month specified, not *)
  if (dayOfMonth !== "*") return 30 * 24 * 60 * 60 * 1000;

  // Default: daily
  return 24 * 60 * 60 * 1000;
}

export class Scheduler {
  private rules: SchedulerRule[] = [];
  private timers: ReturnType<typeof setInterval>[] = [];
  private running = false;
  private actionHandler?: ActionHandler;

  /** Parse a human-readable trigger or cron expression */
  static parseTrigger(trigger: string): string | null {
    const trimmed = trigger.trim().toLowerCase();
    if (!trimmed) return null;

    // Check exact matches in map
    if (TRIGGER_MAP[trimmed]) return TRIGGER_MAP[trimmed];

    // Check "every day Xam/pm" pattern
    const timeMatch = trimmed.match(TIME_REGEX);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const period = timeMatch[2].toLowerCase();
      if (period === "pm" && hour !== 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;
      return `0 ${hour} * * *`;
    }

    // Check raw cron expression
    if (CRON_REGEX.test(trimmed)) return trimmed;

    return null;
  }

  addRule(input: {
    realmId: string;
    entityId?: string;
    trigger: string;
    action: string;
  }): void {
    const cronExpression = Scheduler.parseTrigger(input.trigger);
    if (!cronExpression) {
      log.warn(`Skipping rule with unrecognized trigger: "${input.trigger}"`);
      return;
    }

    this.rules.push({
      realmId: input.realmId,
      entityId: input.entityId,
      trigger: input.trigger,
      action: input.action,
      cronExpression,
    });
    log.info(
      `Added rule: "${input.action}" (${input.trigger} → ${cronExpression})`,
    );
  }

  listRules(): readonly SchedulerRule[] {
    return this.rules;
  }

  clearRules(): void {
    this.stop();
    this.rules = [];
  }

  setActionHandler(handler: ActionHandler): void {
    this.actionHandler = handler;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const rule of this.rules) {
      const interval = cronToInterval(rule.cronExpression);
      const timer = setInterval(() => {
        if (this.actionHandler) {
          Promise.resolve(this.actionHandler(rule)).catch((err) => {
            log.warn(
              `Rule execution failed: "${rule.action}" — ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        }
      }, interval);

      // Unref so the timer doesn't prevent Node from exiting
      timer.unref();
      this.timers.push(timer);
    }

    log.info(`Scheduler started with ${this.rules.length} rules`);
  }

  stop(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}
