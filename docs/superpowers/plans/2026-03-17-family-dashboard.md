# Family Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight family status dashboard (Mini Dashboard) as `packages/dashboard` — a Vite + React SPA served by the ink gateway, providing family overview, route visualization, member management, entity management, and settings for non-technical family users.

**Architecture:** The dashboard is a Vite 6 + React 19 SPA that communicates with the ink gateway via WebSocket RPC (port 19789). Build output is static files served by Express on the HTTP port (19790) at `/dashboard/`. The dashboard reuses `@openoctopus/shared` RPC types and connects using the same JSON-RPC protocol as the CLI.

**Tech Stack:** Vite 6, React 19, TypeScript (strict), Tailwind CSS v4, Zustand 5, React Router 7, React Flow, Recharts, shadcn/ui, i18next

**Spec:** `docs/superpowers/specs/2026-03-17-family-dashboard-design.md`

---

## File Structure

### New: `packages/dashboard/`

```
packages/dashboard/
├── package.json
├── tsconfig.json
├── tsconfig.node.json              # For vite.config.ts
├── vite.config.ts
├── index.html
├── postcss.config.js
├── tailwind.config.ts
├── src/
│   ├── main.tsx                    # React entry point
│   ├── App.tsx                     # Root component + React Router
│   ├── vite-env.d.ts               # Vite type declarations
│   ├── gateway/
│   │   ├── client.ts               # WebSocket RPC client (auto-reconnect, typed)
│   │   ├── client.test.ts          # Client unit tests
│   │   └── types.ts                # Re-export shared RPC types + dashboard-specific
│   ├── stores/
│   │   ├── gateway.ts              # Connection state (Zustand)
│   │   ├── gateway.test.ts
│   │   ├── family.ts               # Members + routing events
│   │   ├── family.test.ts
│   │   ├── realms.ts               # Realm + Entity data
│   │   └── realms.test.ts
│   ├── hooks/
│   │   ├── use-gateway.ts          # WebSocket connection hook
│   │   ├── use-realms.ts           # Realm CRUD hook
│   │   ├── use-entities.ts         # Entity management hook
│   │   ├── use-members.ts          # Member management hook
│   │   └── use-routing.ts          # Route event subscription hook
│   ├── pages/
│   │   ├── Home.tsx                # Family overview (default)
│   │   ├── RouteView.tsx           # Hub-and-spoke topology visualization
│   │   ├── Members.tsx             # Family member management
│   │   ├── Entities.tsx            # Entity management + SOUL editor
│   │   └── Settings.tsx            # Config, channels, notifications
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Shell.tsx           # App shell (sidebar + content)
│   │   │   ├── Sidebar.tsx         # Desktop sidebar navigation
│   │   │   └── MobileNav.tsx       # Mobile bottom tab navigation
│   │   ├── family/
│   │   │   ├── MemberCard.tsx      # Member display card
│   │   │   └── TopologyGraph.tsx   # React Flow hub-and-spoke graph
│   │   ├── realm/
│   │   │   ├── RealmCard.tsx       # Realm status card
│   │   │   ├── RealmGrid.tsx       # Realm cards grid layout
│   │   │   └── Timeline.tsx        # Family event timeline
│   │   ├── entity/
│   │   │   ├── EntityCard.tsx      # Entity display card
│   │   │   └── SoulEditor.tsx      # Simplified SOUL.md editor
│   │   └── shared/
│   │       └── ... (shadcn/ui components added as needed)
│   ├── styles/
│   │   └── globals.css             # Tailwind base + brand CSS variables
│   └── i18n/
│       ├── index.ts                # i18next setup
│       ├── zh.json                 # Chinese
│       └── en.json                 # English
```

### Modified files

- `packages/ink/src/server.ts` — Add static file serving + SPA fallback for dashboard
- `tsconfig.json` (root) — Add dashboard to project references
- `package.json` (root) — Add `dashboard:dev` and `dashboard:build` scripts
- `vitest.config.ts` (root) — Add dashboard alias
- `knip.config.ts` (root) — Add dashboard workspace config

---

## Chunk 1: Package Scaffold & Gateway Client

### Task 1: Initialize dashboard package

**Files:**
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/tsconfig.node.json`
- Create: `packages/dashboard/vite.config.ts`
- Create: `packages/dashboard/index.html`
- Create: `packages/dashboard/postcss.config.js`
- Create: `packages/dashboard/tailwind.config.ts`
- Create: `packages/dashboard/src/vite-env.d.ts`
- Create: `packages/dashboard/src/styles/globals.css`
- Create: `packages/dashboard/src/main.tsx`
- Create: `packages/dashboard/src/App.tsx`
- Modify: `tsconfig.json` (root)
- Modify: `package.json` (root)
- Modify: `vitest.config.ts` (root)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@openoctopus/dashboard",
  "version": "2026.3.10",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "zustand": "^5.0.0",
    "i18next": "^24.0.0",
    "react-i18next": "^15.0.0",
    "@reactflow/core": "^12.0.0",
    "recharts": "^2.15.0"
  },
  "devDependencies": {
    "@openoctopus/shared": "workspace:*",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.5.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "/dashboard/",
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    outDir: "../ink/public/dashboard",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:19790",
    },
  },
});
```

- [ ] **Step 5: Create index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OpenOctopus - 家庭管家</title>
    <link rel="icon" href="/dashboard/favicon.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create postcss.config.js and tailwind.config.ts**

`postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ocean: "#1E3A5F",
        purple: "#6C3FA0",
        cyan: "#00D4AA",
        abyss: "#0D1117",
        surface: "#F6F8FA",
      },
      borderRadius: {
        card: "16px",
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 7: Create globals.css, vite-env.d.ts, main.tsx, App.tsx**

`src/styles/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-ocean: #1E3A5F;
  --color-cyan: #00D4AA;
  --color-purple: #6C3FA0;
}
```

`src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />
```

`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from "react-router";

function Placeholder({ name }: { name: string }) {
  return <div className="p-8 text-lg text-ocean">{name} - Coming Soon</div>;
}

export function App() {
  return (
    <BrowserRouter basename="/dashboard">
      <Routes>
        <Route path="/" element={<Placeholder name="家庭总览" />} />
        <Route path="/route" element={<Placeholder name="路由视图" />} />
        <Route path="/members" element={<Placeholder name="家庭成员" />} />
        <Route path="/entities" element={<Placeholder name="实体管理" />} />
        <Route path="/settings" element={<Placeholder name="设置" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 8: Update root workspace configs**

Add to `tsconfig.json` references:
```json
{ "path": "packages/dashboard" }
```

Add to `package.json` scripts:
```json
"dashboard:dev": "pnpm --filter @openoctopus/dashboard dev",
"dashboard:build": "pnpm --filter @openoctopus/dashboard build"
```

Add to `vitest.config.ts` alias:
```typescript
"@openoctopus/dashboard": path.join(packages, "dashboard/src/main.tsx"),
```

- [ ] **Step 9: Install dependencies and verify build**

Run: `cd packages/dashboard && pnpm install`
Run: `pnpm dashboard:dev`
Expected: Vite dev server starts on port 5173, shows placeholder page at `/dashboard/`

- [ ] **Step 10: Commit**

```bash
git add packages/dashboard/ tsconfig.json package.json vitest.config.ts
git commit -m "feat(dashboard): scaffold Vite + React package with Tailwind"
```

---

### Task 2: WebSocket RPC client

**Files:**
- Create: `packages/dashboard/src/gateway/types.ts`
- Create: `packages/dashboard/src/gateway/client.ts`
- Create: `packages/dashboard/src/gateway/client.test.ts`

- [ ] **Step 1: Write types.ts**

```typescript
// Re-export shared RPC types for browser usage
// Note: we can't import @openoctopus/shared directly in browser
// (it targets NodeNext), so we re-declare the protocol types here.

export interface RpcRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface RpcResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface RpcEvent {
  event: string;
  requestId?: string;
  data: unknown;
}

// Mirror RPC_METHODS from @openoctopus/shared/rpc-protocol
export const RPC_METHODS = {
  CHAT_SEND: "chat.send",
  REALM_LIST: "realm.list",
  REALM_GET: "realm.get",
  REALM_CREATE: "realm.create",
  REALM_UPDATE: "realm.update",
  REALM_DELETE: "realm.delete",
  ENTITY_LIST: "entity.list",
  ENTITY_GET: "entity.get",
  ENTITY_CREATE: "entity.create",
  ENTITY_UPDATE: "entity.update",
  ENTITY_DELETE: "entity.delete",
  SUMMON_INVOKE: "summon.invoke",
  SUMMON_RELEASE: "summon.release",
  SUMMON_LIST: "summon.list",
  STATUS_HEALTH: "status.health",
  STATUS_INFO: "status.info",
  HEALTH_REPORT: "health.report",
} as const;

export const RPC_EVENTS = {
  TOKEN: "chat.token",
  DONE: "chat.done",
  PROACTIVE: "proactive",
  CHANNEL_MESSAGE: "channel.message",
  REALM_UPDATE: "realm.update",
  CROSS_REALM_REACTION: "crossrealm.reaction",
  HEALTH_ALERT: "health.alert",
  MATURITY_SUGGESTION: "maturity.suggestion",
} as const;
```

- [ ] **Step 2: Write failing test for GatewayClient**

`packages/dashboard/src/gateway/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayClient } from "./client";

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  sent: string[] = [];

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("GatewayClient", () => {
  let mockWs: MockWebSocket;
  let client: GatewayClient;

  beforeEach(() => {
    mockWs = new MockWebSocket();
    vi.stubGlobal("WebSocket", vi.fn(() => mockWs));
    client = new GatewayClient("ws://localhost:19789");
  });

  afterEach(() => {
    client.disconnect();
    vi.unstubAllGlobals();
  });

  it("connects to gateway", () => {
    client.connect();
    expect(vi.mocked(WebSocket)).toHaveBeenCalledWith("ws://localhost:19789");
  });

  it("sends RPC request and receives response", async () => {
    client.connect();
    mockWs.simulateOpen();

    const promise = client.request("realm.list", {});

    // Parse sent message and respond
    const sent = JSON.parse(mockWs.sent[0]);
    expect(sent.method).toBe("realm.list");

    mockWs.simulateMessage({ id: sent.id, result: [{ id: "realm_1", name: "pet" }] });

    const result = await promise;
    expect(result).toEqual([{ id: "realm_1", name: "pet" }]);
  });

  it("handles RPC error response", async () => {
    client.connect();
    mockWs.simulateOpen();

    const promise = client.request("realm.get", { id: "nonexistent" });

    const sent = JSON.parse(mockWs.sent[0]);
    mockWs.simulateMessage({ id: sent.id, error: { code: 404, message: "Not found" } });

    await expect(promise).rejects.toThrow("Not found");
  });

  it("subscribes to events", () => {
    client.connect();
    mockWs.simulateOpen();

    const handler = vi.fn();
    client.on("crossrealm.reaction", handler);

    mockWs.simulateMessage({ event: "crossrealm.reaction", data: { realmId: "realm_1" } });

    expect(handler).toHaveBeenCalledWith({ realmId: "realm_1" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test:unit -- --filter packages/dashboard`
Expected: FAIL — `GatewayClient` not found

- [ ] **Step 4: Implement GatewayClient**

`packages/dashboard/src/gateway/client.ts`:
```typescript
import type { RpcRequest, RpcResponse, RpcEvent } from "./types";

type EventHandler = (data: unknown) => void;
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Map<string, Set<EventHandler>>();
  private url: string;
  private reconnectDelay = 800;
  private maxReconnectDelay = 15000;
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.reconnectDelay = 800;
    this.createConnection();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // Reject all pending requests
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Client disconnected"));
      this.pending.delete(id);
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to gateway");
    }

    const id = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const request: RpcRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify(request));
    });
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  private createConnection(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 800;
      this.emit("_connected", null);
    };

    this.ws.onclose = () => {
      this.emit("_disconnected", null);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string);
        this.handleMessage(data);
      } catch {
        // Ignore malformed messages
      }
    };
  }

  private handleMessage(data: RpcResponse | RpcEvent): void {
    // RPC response (has id)
    if ("id" in data && typeof data.id === "string") {
      const response = data as RpcResponse;
      const pending = this.pending.get(response.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
      return;
    }

    // RPC event (has event)
    if ("event" in data && typeof data.event === "string") {
      const event = data as RpcEvent;
      this.emit(event.event, event.data);
    }
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test:unit -- --filter packages/dashboard`
Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/gateway/
git commit -m "feat(dashboard): add WebSocket RPC client with auto-reconnect"
```

---

### Task 3: Zustand stores

**Files:**
- Create: `packages/dashboard/src/stores/gateway.ts`
- Create: `packages/dashboard/src/stores/gateway.test.ts`
- Create: `packages/dashboard/src/stores/realms.ts`
- Create: `packages/dashboard/src/stores/family.ts`

- [ ] **Step 1: Write failing test for gateway store**

`packages/dashboard/src/stores/gateway.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useGatewayStore } from "./gateway";

describe("useGatewayStore", () => {
  beforeEach(() => {
    useGatewayStore.setState({
      status: "disconnected",
      url: "ws://localhost:19789",
      error: null,
    });
  });

  it("has correct initial state", () => {
    const state = useGatewayStore.getState();
    expect(state.status).toBe("disconnected");
    expect(state.url).toBe("ws://localhost:19789");
    expect(state.error).toBeNull();
  });

  it("updates status", () => {
    useGatewayStore.getState().setStatus("connected");
    expect(useGatewayStore.getState().status).toBe("connected");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- --filter packages/dashboard`
Expected: FAIL — module not found

- [ ] **Step 3: Implement stores**

`packages/dashboard/src/stores/gateway.ts`:
```typescript
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
  setStatus: (status) => set({ status, error: status === "connected" ? null : undefined }),
  setUrl: (url) => set({ url }),
  setError: (error) => set({ error, status: error ? "error" : "disconnected" }),
}));
```

`packages/dashboard/src/stores/realms.ts`:
```typescript
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
```

`packages/dashboard/src/stores/family.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit -- --filter packages/dashboard`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/stores/
git commit -m "feat(dashboard): add Zustand stores for gateway, realms, family"
```

---

## Chunk 2: Layout & Home Page

### Task 4: App shell and navigation

**Files:**
- Create: `packages/dashboard/src/components/layout/Shell.tsx`
- Create: `packages/dashboard/src/components/layout/Sidebar.tsx`
- Create: `packages/dashboard/src/components/layout/MobileNav.tsx`
- Modify: `packages/dashboard/src/App.tsx`

- [ ] **Step 1: Create Sidebar**

`packages/dashboard/src/components/layout/Sidebar.tsx`:
```tsx
import { NavLink } from "react-router";

const NAV_ITEMS = [
  { path: "/", icon: "🏠", label: "家庭总览" },
  { path: "/route", icon: "🔀", label: "路由视图" },
  { path: "/members", icon: "👥", label: "家庭成员" },
  { path: "/entities", icon: "🎯", label: "实体管理" },
  { path: "/settings", icon: "⚙️", label: "设置" },
];

export function Sidebar() {
  return (
    <nav className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 p-4 gap-1">
      <div className="flex items-center gap-2 px-3 py-4 mb-4">
        <span className="text-2xl">🐙</span>
        <span className="font-bold text-ocean text-lg">家庭管家</span>
      </div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/"}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
              isActive
                ? "bg-cyan/10 text-ocean font-medium"
                : "text-gray-600 hover:bg-gray-100"
            }`
          }
        >
          <span className="text-lg">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create MobileNav**

`packages/dashboard/src/components/layout/MobileNav.tsx`:
```tsx
import { NavLink } from "react-router";

const NAV_ITEMS = [
  { path: "/", icon: "🏠", label: "总览" },
  { path: "/route", icon: "🔀", label: "路由" },
  { path: "/members", icon: "👥", label: "成员" },
  { path: "/entities", icon: "🎯", label: "实体" },
  { path: "/settings", icon: "⚙️", label: "设置" },
];

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 z-50">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
              isActive ? "text-ocean font-medium" : "text-gray-500"
            }`
          }
        >
          <span className="text-xl">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Create Shell and update App**

`packages/dashboard/src/components/layout/Shell.tsx`:
```tsx
import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

export function Shell() {
  return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
```

Update `src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from "react-router";
import { Shell } from "./components/layout/Shell";

function Placeholder({ name }: { name: string }) {
  return <div className="p-6 text-lg text-ocean">{name} - Coming Soon</div>;
}

export function App() {
  return (
    <BrowserRouter basename="/dashboard">
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Placeholder name="🏠 家庭总览" />} />
          <Route path="route" element={<Placeholder name="🔀 路由视图" />} />
          <Route path="members" element={<Placeholder name="👥 家庭成员" />} />
          <Route path="entities" element={<Placeholder name="🎯 实体管理" />} />
          <Route path="settings" element={<Placeholder name="⚙️ 设置" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Verify in browser**

Run: `pnpm dashboard:dev`
Expected: Desktop shows sidebar + content area. Mobile shows bottom tabs. Navigation works between pages.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/layout/ packages/dashboard/src/App.tsx
git commit -m "feat(dashboard): add app shell with sidebar and mobile navigation"
```

---

### Task 5: Home page — Realm grid + Timeline

**Files:**
- Create: `packages/dashboard/src/components/realm/RealmCard.tsx`
- Create: `packages/dashboard/src/components/realm/RealmGrid.tsx`
- Create: `packages/dashboard/src/components/realm/Timeline.tsx`
- Create: `packages/dashboard/src/pages/Home.tsx`

- [ ] **Step 1: Create RealmCard**

`packages/dashboard/src/components/realm/RealmCard.tsx`:
```tsx
interface RealmCardProps {
  name: string;
  icon: string;
  lines: string[];
  alert?: boolean;
}

export function RealmCard({ name, icon, lines, alert }: RealmCardProps) {
  return (
    <div
      className={`bg-white rounded-card p-4 border transition-shadow hover:shadow-md ${
        alert ? "border-orange-300" : "border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="font-medium text-ocean text-sm">{name}</span>
        {alert && <span className="text-orange-500 text-xs">⚠️</span>}
      </div>
      <div className="space-y-1">
        {lines.map((line, i) => (
          <p key={i} className="text-xs text-gray-600 truncate">{line}</p>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create RealmGrid**

`packages/dashboard/src/components/realm/RealmGrid.tsx`:
```tsx
import { RealmCard } from "./RealmCard";

// Placeholder data — will be replaced by store data via hooks
const PLACEHOLDER_REALMS = [
  { name: "健康", icon: "🏥", lines: ["爷爷膝盖待复查", "降压药剩 5 天"], alert: true },
  { name: "财务", icon: "💰", lines: ["本月 ¥8,240", "预算剩 ¥3,760"] },
  { name: "宠物", icon: "🐱", lines: ["橘子：驱虫 3/24", "体重 5.2kg 正常"] },
  { name: "教育", icon: "📚", lines: ["春游费 ✅ 已交", "舞蹈课 周二"] },
  { name: "车辆", icon: "🚗", lines: ["保养还剩 1200km", "车险 4/15 到期"] },
  { name: "家务", icon: "🏠", lines: ["洗衣液快用完", "猫粮剩 3 天"] },
];

export function RealmGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {PLACEHOLDER_REALMS.map((r) => (
        <RealmCard key={r.name} {...r} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create Timeline**

`packages/dashboard/src/components/realm/Timeline.tsx`:
```tsx
interface TimelineEvent {
  time: string;
  text: string;
}

const PLACEHOLDER_EVENTS: Array<{ date: string; events: TimelineEvent[] }> = [
  {
    date: "今天",
    events: [
      { time: "10:32", text: "爷爷说膝盖疼 → 已通知爸爸(就医建议)、妈妈(采购)" },
      { time: "08:00", text: "晨间简报已推送给全家" },
    ],
  },
  {
    date: "昨天",
    events: [
      { time: "16:20", text: "女儿春游费 ¥180 → 妈妈已确认转账" },
      { time: "09:15", text: "橘子体重 5.2kg → 正常范围（自动记录）" },
    ],
  },
];

export function Timeline() {
  return (
    <div className="bg-white rounded-card border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-ocean mb-3">📋 家庭时间线</h3>
      <div className="space-y-4">
        {PLACEHOLDER_EVENTS.map((group) => (
          <div key={group.date}>
            <p className="text-xs text-gray-400 mb-1.5">{group.date}</p>
            <div className="space-y-2">
              {group.events.map((event, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="text-gray-400 shrink-0">{event.time}</span>
                  <span className="text-gray-700">{event.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Home page**

`packages/dashboard/src/pages/Home.tsx`:
```tsx
import { RealmGrid } from "../components/realm/RealmGrid";
import { Timeline } from "../components/realm/Timeline";

export function Home() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ocean">🐙 王家 · 家庭管家</h1>
      </div>
      <RealmGrid />
      <Timeline />
    </div>
  );
}
```

- [ ] **Step 5: Wire Home into App.tsx**

Replace `Placeholder` for index route with `Home`:
```tsx
import { Home } from "./pages/Home";
// ...
<Route index element={<Home />} />
```

- [ ] **Step 6: Verify in browser**

Run: `pnpm dashboard:dev`
Expected: Home page shows Realm card grid (6 cards, responsive) and Timeline with placeholder events.

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/components/realm/ packages/dashboard/src/pages/Home.tsx packages/dashboard/src/App.tsx
git commit -m "feat(dashboard): add Home page with Realm grid and Timeline"
```

---

## Chunk 3: Route View & Ink Integration

### Task 6: Route visualization with React Flow

**Files:**
- Create: `packages/dashboard/src/components/family/TopologyGraph.tsx`
- Create: `packages/dashboard/src/pages/RouteView.tsx`

- [ ] **Step 1: Create TopologyGraph**

`packages/dashboard/src/components/family/TopologyGraph.tsx`:
```tsx
import { ReactFlow, type Node, type Edge, Position, Background } from "@reactflow/core";
import "@reactflow/core/dist/style.css";

interface TopologyProps {
  members: Array<{ id: string; name: string; icon: string }>;
  routes?: Array<{ from: string; to: string; relevance: "high" | "medium" | "low"; pushed: boolean }>;
}

export function TopologyGraph({ members, routes = [] }: TopologyProps) {
  const centerX = 300;
  const centerY = 200;
  const radius = 150;

  const hubNode: Node = {
    id: "hub",
    data: { label: "🐙 管家" },
    position: { x: centerX - 40, y: centerY - 20 },
    style: {
      background: "#00D4AA",
      color: "white",
      borderRadius: "16px",
      padding: "8px 16px",
      fontWeight: "bold",
      border: "none",
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };

  const memberNodes: Node[] = members.map((m, i) => {
    const angle = (2 * Math.PI * i) / members.length - Math.PI / 2;
    return {
      id: m.id,
      data: { label: `${m.icon} ${m.name}` },
      position: {
        x: centerX + radius * Math.cos(angle) - 40,
        y: centerY + radius * Math.sin(angle) - 15,
      },
      style: {
        background: "white",
        borderRadius: "12px",
        padding: "6px 12px",
        border: "1px solid #e5e7eb",
        fontSize: "13px",
      },
    };
  });

  const edges: Edge[] = members.map((m) => {
    const route = routes.find((r) => r.to === m.id);
    return {
      id: `hub-${m.id}`,
      source: "hub",
      target: m.id,
      style: {
        stroke: route?.pushed ? (route.relevance === "high" ? "#00D4AA" : "#94a3b8") : "#e5e7eb",
        strokeWidth: route?.pushed ? 2 : 1,
        strokeDasharray: route?.pushed ? undefined : "5,5",
      },
      animated: route?.pushed ?? false,
    };
  });

  return (
    <div className="w-full h-80 bg-white rounded-card border border-gray-200">
      <ReactFlow
        nodes={[hubNode, ...memberNodes]}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: Create RouteView page**

`packages/dashboard/src/pages/RouteView.tsx`:
```tsx
import { TopologyGraph } from "../components/family/TopologyGraph";

const PLACEHOLDER_MEMBERS = [
  { id: "grandpa", name: "爷爷", icon: "👴" },
  { id: "dad", name: "爸爸", icon: "👨" },
  { id: "mom", name: "妈妈", icon: "👩" },
  { id: "daughter", name: "女儿", icon: "👧" },
];

const PLACEHOLDER_ROUTES = [
  { from: "grandpa", to: "dad", relevance: "high" as const, pushed: true },
  { from: "grandpa", to: "mom", relevance: "medium" as const, pushed: true },
  { from: "grandpa", to: "daughter", relevance: "low" as const, pushed: false },
];

export function RouteView() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold text-ocean">🔀 消息路由</h1>
      <TopologyGraph members={PLACEHOLDER_MEMBERS} routes={PLACEHOLDER_ROUTES} />

      <div className="bg-white rounded-card border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-ocean mb-3">最近路由</h3>
        <div className="space-y-3">
          <div className="text-xs space-y-1">
            <p className="font-medium text-gray-800">[爷爷膝盖疼] Health → Finance, Calendar</p>
            <p className="text-gray-600 pl-3">→ 👨 爸爸：就医建议（高相关）</p>
            <p className="text-gray-600 pl-3">→ 👩 妈妈：采购止痛贴（中相关）</p>
            <p className="text-gray-400 pl-3">→ 👧 女儿：未推送（低相关）</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into App.tsx**

```tsx
import { RouteView } from "./pages/RouteView";
// ...
<Route path="route" element={<RouteView />} />
```

- [ ] **Step 4: Verify in browser**

Run: `pnpm dashboard:dev`
Expected: Route View shows star topology with hub in center, 4 member nodes, animated edges for pushed routes, dimmed edges for unpushed.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/family/ packages/dashboard/src/pages/RouteView.tsx packages/dashboard/src/App.tsx
git commit -m "feat(dashboard): add Route View with React Flow topology graph"
```

---

### Task 7: Ink gateway static file serving

**Files:**
- Modify: `packages/ink/src/server.ts`

- [ ] **Step 1: Add static file serving to ink server**

Add after the API routes (line 136) and before the error handler (line 138) in `packages/ink/src/server.ts`:

```typescript
  // ── Dashboard static files (built SPA) ──
  const dashboardDir = path.resolve(import.meta.dirname, "../../dashboard/dist");
  // Only serve if build output exists (dashboard is optional)
  try {
    const fs = await import("node:fs");
    if (fs.existsSync(path.join(dashboardDir, "index.html"))) {
      app.use("/dashboard", express.static(dashboardDir));
      // SPA fallback: serve index.html for all /dashboard/* routes
      app.get("/dashboard/*", (_req, res) => {
        res.sendFile(path.join(dashboardDir, "index.html"));
      });
      log.info(`Dashboard serving from ${dashboardDir}`);
    }
  } catch {
    // Dashboard not built — skip silently
  }
```

Note: The `import.meta.dirname` resolves to `packages/ink/src/` at dev time. For the built bundle, we use `path.resolve(process.cwd(), "packages/ink/public/dashboard")` as fallback. Adjust the path:

```typescript
  const dashboardPaths = [
    path.resolve(import.meta.dirname, "../public/dashboard"),
    path.resolve(process.cwd(), "packages/ink/public/dashboard"),
  ];
```

- [ ] **Step 2: Verify ink still builds and starts**

Run: `pnpm build && pnpm start`
Expected: Gateway starts normally. No errors about missing dashboard directory.

- [ ] **Step 3: Build dashboard and verify serving**

Run: `pnpm dashboard:build && pnpm start`
Then: Open `http://localhost:19790/dashboard/` in browser
Expected: Dashboard loads with sidebar and Home page.

- [ ] **Step 4: Commit**

```bash
git add packages/ink/src/server.ts
git commit -m "feat(ink): serve dashboard static files from HTTP port"
```

---

## Chunk 4: Members, Entities & Settings Pages

### Task 8: Members page

**Files:**
- Create: `packages/dashboard/src/components/family/MemberCard.tsx`
- Create: `packages/dashboard/src/pages/Members.tsx`

- [ ] **Step 1: Create MemberCard and Members page**

`packages/dashboard/src/components/family/MemberCard.tsx`:
```tsx
interface MemberCardProps {
  name: string;
  icon: string;
  role: string;
  channels: string[];
  watchedRealms: string[];
}

const ROLE_LABELS: Record<string, string> = {
  owner: "管理员",
  adult: "成人",
  child: "儿童",
  elder: "老人",
};

export function MemberCard({ name, icon, role, channels, watchedRealms }: MemberCardProps) {
  return (
    <div className="bg-white rounded-card border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="font-medium text-ocean">{name}</p>
          <p className="text-xs text-gray-500">{ROLE_LABELS[role] ?? role}</p>
        </div>
      </div>
      <div className="space-y-2 text-xs">
        <div>
          <span className="text-gray-400">通道：</span>
          {channels.map((c) => (
            <span key={c} className="inline-block bg-green-50 text-green-700 px-1.5 py-0.5 rounded mr-1">
              {c} ✅
            </span>
          ))}
        </div>
        <div>
          <span className="text-gray-400">关注域：</span>
          <span className="text-gray-600">{watchedRealms.join("、")}</span>
        </div>
      </div>
      <button className="mt-3 text-xs text-cyan hover:underline">编辑</button>
    </div>
  );
}
```

`packages/dashboard/src/pages/Members.tsx`:
```tsx
import { MemberCard } from "../components/family/MemberCard";

const PLACEHOLDER_MEMBERS = [
  { name: "爸爸（王明）", icon: "👨", role: "adult", channels: ["微信", "Telegram"], watchedRealms: ["健康", "财务", "车辆", "工作"] },
  { name: "妈妈（李雪）", icon: "👩", role: "owner", channels: ["微信"], watchedRealms: ["全部"] },
  { name: "爷爷（王德）", icon: "👴", role: "elder", channels: ["微信"], watchedRealms: ["健康"] },
  { name: "女儿（王小雪）", icon: "👧", role: "child", channels: ["微信"], watchedRealms: ["教育"] },
];

export function Members() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ocean">👥 家庭成员</h1>
        <button className="bg-cyan text-white px-4 py-2 rounded-xl text-sm hover:bg-cyan/90">
          + 邀请成员
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLACEHOLDER_MEMBERS.map((m) => (
          <MemberCard key={m.name} {...m} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.tsx, verify, commit**

```bash
git add packages/dashboard/src/components/family/MemberCard.tsx packages/dashboard/src/pages/Members.tsx packages/dashboard/src/App.tsx
git commit -m "feat(dashboard): add Members page with member cards"
```

---

### Task 9: Entities page

**Files:**
- Create: `packages/dashboard/src/components/entity/EntityCard.tsx`
- Create: `packages/dashboard/src/components/entity/SoulEditor.tsx`
- Create: `packages/dashboard/src/pages/Entities.tsx`

- [ ] **Step 1: Create EntityCard, SoulEditor, and Entities page**

`packages/dashboard/src/components/entity/EntityCard.tsx`:
```tsx
interface EntityCardProps {
  name: string;
  type: string;
  realm: string;
  icon: string;
  attributes: string[];
  memoryCount: number;
  healthScore: number;
  onEdit?: () => void;
}

export function EntityCard({ name, icon, type, realm, attributes, memoryCount, healthScore, onEdit }: EntityCardProps) {
  return (
    <div className="bg-white rounded-card border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="font-medium text-ocean">{name}</p>
            <p className="text-xs text-gray-400">{type} · {realm}</p>
          </div>
        </div>
        <div className="text-right text-xs">
          <p className="text-gray-400">{memoryCount} 条记忆</p>
          <p className={healthScore >= 80 ? "text-green-600" : "text-orange-500"}>
            健康分 {healthScore}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {attributes.map((attr) => (
          <span key={attr} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {attr}
          </span>
        ))}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="mt-3 text-xs text-cyan hover:underline">
          编辑
        </button>
      )}
    </div>
  );
}
```

`packages/dashboard/src/components/entity/SoulEditor.tsx`:
```tsx
import { useState } from "react";

interface SoulEditorProps {
  name: string;
  tone: string;
  traits: string[];
  onSave?: (data: { tone: string; traits: string[] }) => void;
}

export function SoulEditor({ name, tone: initialTone, traits: initialTraits, onSave }: SoulEditorProps) {
  const [tone, setTone] = useState(initialTone);
  const [traits, setTraits] = useState(initialTraits.join(", "));

  return (
    <div className="bg-white rounded-card border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-medium text-ocean">✨ {name} 的性格设置</h3>
      <div>
        <label className="block text-xs text-gray-500 mb-1">语气风格</label>
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="例：活泼好动、偶尔撒娇"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">性格特征（逗号分隔）</label>
        <input
          value={traits}
          onChange={(e) => setTraits(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="例：贪吃, 怕打雷, 爱游泳"
        />
      </div>
      <button
        onClick={() => onSave?.({ tone, traits: traits.split(",").map((t) => t.trim()).filter(Boolean) })}
        className="bg-cyan text-white px-4 py-1.5 rounded-lg text-sm hover:bg-cyan/90"
      >
        保存
      </button>
    </div>
  );
}
```

`packages/dashboard/src/pages/Entities.tsx`:
```tsx
import { useState } from "react";
import { EntityCard } from "../components/entity/EntityCard";
import { SoulEditor } from "../components/entity/SoulEditor";

const REALMS = ["全部", "宠物", "健康", "车辆", "教育"];
const PLACEHOLDER_ENTITIES = [
  { name: "橘子", icon: "🐱", type: "living", realm: "宠物", attributes: ["英短", "3岁", "5.2kg"], memoryCount: 23, healthScore: 85 },
  { name: "爷爷的膝盖", icon: "🦵", type: "abstract", realm: "健康", attributes: ["左膝", "复查中"], memoryCount: 8, healthScore: 60 },
  { name: "家用车", icon: "🚗", type: "asset", realm: "车辆", attributes: ["荣威", "2022款"], memoryCount: 12, healthScore: 75 },
];

export function Entities() {
  const [filter, setFilter] = useState("全部");
  const [editingEntity, setEditingEntity] = useState<string | null>(null);

  const filtered = filter === "全部" ? PLACEHOLDER_ENTITIES : PLACEHOLDER_ENTITIES.filter((e) => e.realm === filter);

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-ocean">🎯 实体管理</h1>
        <button className="bg-cyan text-white px-4 py-2 rounded-xl text-sm hover:bg-cyan/90">
          + 添加实体
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {REALMS.map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-3 py-1.5 rounded-lg text-xs ${
              filter === r ? "bg-ocean text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((e) => (
          <div key={e.name}>
            <EntityCard {...e} onEdit={() => setEditingEntity(editingEntity === e.name ? null : e.name)} />
            {editingEntity === e.name && (
              <div className="mt-2 ml-4">
                <SoulEditor name={e.name} tone="活泼好动、偶尔撒娇" traits={["贪吃", "怕打雷", "爱游泳"]} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.tsx, verify, commit**

```bash
git add packages/dashboard/src/components/entity/ packages/dashboard/src/pages/Entities.tsx packages/dashboard/src/App.tsx
git commit -m "feat(dashboard): add Entities page with entity cards and SOUL editor"
```

---

### Task 10: Settings page

**Files:**
- Create: `packages/dashboard/src/pages/Settings.tsx`

- [ ] **Step 1: Create Settings page**

`packages/dashboard/src/pages/Settings.tsx`:
```tsx
export function Settings() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-ocean">⚙️ 设置</h1>

      {/* AI Model */}
      <section className="bg-white rounded-card border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-ocean mb-3">🤖 AI 模型</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">当前模型</span>
            <span className="text-ocean font-medium">Claude Sonnet 4</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">API Key</span>
            <span className="text-gray-400 font-mono text-xs">sk-ant-•••••••el3</span>
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="bg-white rounded-card border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-ocean mb-3">📱 通道连接</h2>
        <div className="space-y-2">
          {[
            { name: "微信小程序", status: true },
            { name: "Telegram Bot", status: true },
            { name: "Discord", status: false },
          ].map((ch) => (
            <div key={ch.name} className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{ch.name}</span>
              <span className={ch.status ? "text-green-600" : "text-gray-400"}>
                {ch.status ? "✅ 已连接" : "⬜ 未连接"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-card border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-ocean mb-3">🔔 通知策略</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">晨间简报</span>
            <span className="text-ocean">每天 08:00</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">最大推送频率</span>
            <span className="text-ocean">每小时 3 条</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">免打扰时段</span>
            <span className="text-ocean">22:00 - 07:00</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">紧急事件</span>
            <span className="text-red-500 text-xs">始终推送</span>
          </div>
        </div>
      </section>

      {/* Data */}
      <section className="bg-white rounded-card border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-ocean mb-3">💾 数据</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">存储位置</span>
            <span className="text-ocean">本地 (SQLite)</span>
          </div>
          <button className="text-cyan text-xs hover:underline">导出家庭数据</button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.tsx, verify, commit**

```bash
git add packages/dashboard/src/pages/Settings.tsx packages/dashboard/src/App.tsx
git commit -m "feat(dashboard): add Settings page"
```

---

### Task 11: i18n setup

**Files:**
- Create: `packages/dashboard/src/i18n/index.ts`
- Create: `packages/dashboard/src/i18n/zh.json`
- Create: `packages/dashboard/src/i18n/en.json`
- Modify: `packages/dashboard/src/main.tsx`

- [ ] **Step 1: Create i18n config and translation files**

`packages/dashboard/src/i18n/index.ts`:
```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./zh.json";
import en from "./en.json";

i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh }, en: { translation: en } },
  lng: localStorage.getItem("oo-lang") ?? "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

export default i18n;
```

`packages/dashboard/src/i18n/zh.json`:
```json
{
  "nav.home": "家庭总览",
  "nav.route": "路由视图",
  "nav.members": "家庭成员",
  "nav.entities": "实体管理",
  "nav.settings": "设置",
  "home.title": "家庭管家",
  "home.timeline": "家庭时间线"
}
```

`packages/dashboard/src/i18n/en.json`:
```json
{
  "nav.home": "Family Overview",
  "nav.route": "Route View",
  "nav.members": "Members",
  "nav.entities": "Entities",
  "nav.settings": "Settings",
  "home.title": "Family Butler",
  "home.timeline": "Family Timeline"
}
```

- [ ] **Step 2: Import i18n in main.tsx**

Add to `src/main.tsx` before the render:
```typescript
import "./i18n";
```

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/i18n/ packages/dashboard/src/main.tsx
git commit -m "feat(dashboard): add i18n with Chinese and English"
```

---

### Task 12: Final integration — hooks + knip config + full build verify

**Files:**
- Create: `packages/dashboard/src/hooks/use-gateway.ts`
- Modify: `knip.config.ts` (root)

- [ ] **Step 1: Create use-gateway hook**

`packages/dashboard/src/hooks/use-gateway.ts`:
```typescript
import { useEffect, useRef } from "react";
import { GatewayClient } from "../gateway/client";
import { useGatewayStore } from "../stores/gateway";

export function useGateway() {
  const clientRef = useRef<GatewayClient | null>(null);
  const { url, setStatus, setError } = useGatewayStore();

  useEffect(() => {
    // Read gateway URL from query params or store
    const params = new URLSearchParams(window.location.search);
    const gatewayUrl = params.get("gatewayUrl") ?? url;

    const client = new GatewayClient(gatewayUrl);
    clientRef.current = client;

    client.on("_connected", () => setStatus("connected"));
    client.on("_disconnected", () => setStatus("connecting"));

    setStatus("connecting");
    client.connect();

    return () => {
      client.disconnect();
      setStatus("disconnected");
    };
  }, [url, setStatus, setError]);

  return clientRef;
}
```

- [ ] **Step 2: Add dashboard to knip config**

Add workspace entry for dashboard in `knip.config.ts`.

- [ ] **Step 3: Full build and verify**

Run: `pnpm install && pnpm typecheck && pnpm dashboard:build && pnpm start`
Expected:
- TypeScript compiles without errors
- Dashboard builds to `packages/ink/public/dashboard/`
- Gateway serves dashboard at `http://localhost:19790/dashboard/`
- All 5 pages navigate correctly
- Responsive layout works on mobile viewport

- [ ] **Step 4: Final commit**

```bash
git add packages/dashboard/src/hooks/ knip.config.ts
git commit -m "feat(dashboard): add gateway hook and complete integration"
```
