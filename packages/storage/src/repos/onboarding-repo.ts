import type Database from "better-sqlite3";

interface OnboardingRow {
  user_key: string;
  completed: number;
  completed_at: string | null;
  realms_seeded: string;
}

export interface OnboardingState {
  completed: boolean;
  completedAt?: string;
  realmsSeeded: string[];
}

export class OnboardingRepo {
  constructor(private db: Database.Database) {}

  isCompleted(): boolean {
    const row = this.db
      .prepare("SELECT completed FROM onboarding_state WHERE user_key = 'default'")
      .get() as { completed: number } | undefined;
    return row?.completed === 1;
  }

  markCompleted(realmsSeeded: string[]): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO onboarding_state (user_key, completed, completed_at, realms_seeded)
         VALUES ('default', 1, ?, ?)
         ON CONFLICT(user_key) DO UPDATE SET
           completed = 1,
           completed_at = excluded.completed_at,
           realms_seeded = excluded.realms_seeded`,
      )
      .run(now, JSON.stringify(realmsSeeded));
  }

  getState(): OnboardingState {
    const row = this.db
      .prepare("SELECT * FROM onboarding_state WHERE user_key = 'default'")
      .get() as OnboardingRow | undefined;

    if (!row) {
      return { completed: false, realmsSeeded: [] };
    }

    return {
      completed: row.completed === 1,
      completedAt: row.completed_at ?? undefined,
      realmsSeeded: JSON.parse(row.realms_seeded) as string[],
    };
  }
}
