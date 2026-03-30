import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useFamilyStore } from "../stores/family";
import { useGatewayStore } from "../stores/gateway";
import { useRealmsStore } from "../stores/realms";
import { Settings } from "./Settings";

describe("Settings page", () => {
  beforeEach(() => {
    useGatewayStore.setState({ status: "disconnected", url: "ws://localhost:19789", error: null });
    useRealmsStore.setState({ realms: [], entities: [] });
    useFamilyStore.setState({ members: [], routeEvents: [] });
  });

  it("shows gateway URL from store", () => {
    render(<Settings />);
    expect(screen.getByText("ws://localhost:19789")).toBeInTheDocument();
  });

  it("shows disconnected gateway status", () => {
    render(<Settings />);
    // Gateway section label "状态" paired with "⬜ 未连接"
    expect(screen.getByText("状态")).toBeInTheDocument();
    expect(screen.getAllByText("⬜ 未连接").length).toBeGreaterThanOrEqual(1);
  });

  it("shows connecting gateway status", () => {
    useGatewayStore.setState({ status: "connecting" });
    render(<Settings />);
    expect(screen.getByText(/连接中…/)).toBeInTheDocument();
  });

  it("shows connected gateway status", () => {
    useGatewayStore.setState({ status: "connected" });
    render(<Settings />);
    // Gateway status + 2 channel statuses = at least 3 "✅ 已连接" elements
    expect(screen.getAllByText("✅ 已连接").length).toBeGreaterThanOrEqual(3);
  });

  it("shows error message when present", () => {
    useGatewayStore.setState({ status: "error", error: "Connection refused" });
    render(<Settings />);
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("shows live data counts", () => {
    useRealmsStore.setState({
      realms: [
        { id: "r1", name: "a" },
        { id: "r2", name: "b" },
      ],
      entities: [{ id: "e1", name: "x", type: "living", realmId: "r1" }],
    });
    useFamilyStore.setState({
      members: [{ id: "m1", name: "test", role: "adult", channels: [], watchedRealms: [] }],
      routeEvents: [],
    });

    render(<Settings />);
    expect(screen.getByText("2 个领域 · 1 个实体 · 1 个成员")).toBeInTheDocument();
  });
});
