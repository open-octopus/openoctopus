export interface TuiState {
  connectionMode: "ws" | "http" | "disconnected";
  currentRealm?: { id: string; name: string };
  currentEntity?: { id: string; name: string };
  sessionId?: string;
  isStreaming: boolean;
}

export function createInitialState(mode: "ws" | "http"): TuiState {
  return {
    connectionMode: mode,
    isStreaming: false,
  };
}
