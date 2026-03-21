import { create } from "zustand";

interface Realm {
  id: string;
  name: string;
  icon?: string;
  status?: string;
  entityCount?: number;
  healthScore?: number;
}

interface Entity {
  id: string;
  name: string;
  type: "living" | "asset" | "organization" | "abstract";
  realmId: string;
  attributes?: Record<string, unknown>;
}

interface RealmsState {
  realms: Realm[];
  entities: Entity[];
  setRealms: (realms: Realm[]) => void;
  setEntities: (entities: Entity[]) => void;
  updateRealm: (id: string, data: Partial<Realm>) => void;
}

export const useRealmsStore = create<RealmsState>((set) => ({
  realms: [],
  entities: [],
  setRealms: (realms) => set({ realms }),
  setEntities: (entities) => set({ entities }),
  updateRealm: (id, data) =>
    set((state) => ({
      realms: state.realms.map((r) => (r.id === id ? { ...r, ...data } : r)),
    })),
}));
