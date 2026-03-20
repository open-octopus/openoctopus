import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useRealmsStore } from "../../stores/realms";
import { RealmGrid } from "./RealmGrid";

describe("RealmGrid", () => {
  beforeEach(() => {
    useRealmsStore.setState({ realms: [], entities: [] });
  });

  it("renders placeholder realms when store is empty", () => {
    render(<RealmGrid />);
    expect(screen.getByText("健康")).toBeInTheDocument();
    expect(screen.getByText("财务")).toBeInTheDocument();
    expect(screen.getByText("宠物")).toBeInTheDocument();
    expect(screen.getByText("教育")).toBeInTheDocument();
    expect(screen.getByText("车辆")).toBeInTheDocument();
    expect(screen.getByText("家务")).toBeInTheDocument();
  });

  it("renders store realms when available", () => {
    useRealmsStore.setState({
      realms: [
        { id: "r1", name: "宠物", icon: "🐱", entityCount: 3, healthScore: 90 },
        { id: "r2", name: "法务", icon: "⚖️", entityCount: 1, healthScore: 50 },
      ],
      entities: [],
    });

    render(<RealmGrid />);
    expect(screen.getByText("宠物")).toBeInTheDocument();
    expect(screen.getByText("3 个实体")).toBeInTheDocument();
    expect(screen.getByText("法务")).toBeInTheDocument();
    // Placeholder realms should not appear
    expect(screen.queryByText("家务")).not.toBeInTheDocument();
  });

  it("shows alert indicator for low health score", () => {
    useRealmsStore.setState({
      realms: [
        { id: "r1", name: "健康", healthScore: 50 },
      ],
      entities: [],
    });

    render(<RealmGrid />);
    expect(screen.getByText("⚠️")).toBeInTheDocument();
  });
});
