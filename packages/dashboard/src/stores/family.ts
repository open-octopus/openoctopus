import { create } from "zustand";

interface FamilyMember {
  id: string;
  name: string;
  role: "owner" | "adult" | "child" | "elder";
  avatar?: string;
  channels: string[];
  watchedRealms: string[];
}

interface RouteEvent {
  id: string;
  timestamp: string;
  source: { memberId: string; message: string };
  realms: string[];
  targets: Array<{
    memberId: string;
    relevance: "high" | "medium" | "low";
    pushed: boolean;
    summary: string;
  }>;
}

interface FamilyState {
  members: FamilyMember[];
  routeEvents: RouteEvent[];
  setMembers: (members: FamilyMember[]) => void;
  addRouteEvent: (event: RouteEvent) => void;
}

export const useFamilyStore = create<FamilyState>((set) => ({
  members: [],
  routeEvents: [],
  setMembers: (members) => set({ members }),
  addRouteEvent: (event) =>
    set((state) => ({
      routeEvents: [event, ...state.routeEvents].slice(0, 100),
    })),
}));
