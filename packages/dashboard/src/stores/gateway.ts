import { create } from "zustand";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface GatewayState {
  status: ConnectionStatus;
  url: string;
  error: string | null;
  setStatus: (status: ConnectionStatus) => void;
  setUrl: (url: string) => void;
  setError: (error: string | null) => void;
}

export const useGatewayStore = create<GatewayState>((set) => ({
  status: "disconnected",
  url: "ws://localhost:19789",
  error: null,
  setStatus: (status) =>
    set((state) => ({ status, error: status === "connected" ? null : state.error })),
  setUrl: (url) => set({ url }),
  setError: (error) => set({ error, status: error ? "error" : "disconnected" }),
}));
