export interface RealmSummary {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  entityCount: number;
  status: string;
  agentName?: string;
}

export interface TuiState {
  connectionMode: "ws" | "http" | "disconnected";
  currentRealm?: { id: string; name: string; icon?: string };
  currentEntity?: { id: string; name: string };
  sessionId?: string;
  isStreaming: boolean;
  realms?: RealmSummary[];
}

export function createInitialState(mode: "ws" | "http"): TuiState {
  return {
    connectionMode: mode,
    isStreaming: false,
  };
}
