import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { useRealmsStore } from "../stores/realms";
import { Entities } from "./Entities";

describe("Entities page", () => {
  beforeEach(() => {
    useRealmsStore.setState({ realms: [], entities: [] });
  });

  it("renders placeholder entities when store is empty", () => {
    render(<Entities />);
    expect(screen.getByText("橘子")).toBeInTheDocument();
    expect(screen.getByText("爷爷的膝盖")).toBeInTheDocument();
    expect(screen.getByText("家用车")).toBeInTheDocument();
  });

  it("renders filter buttons", () => {
    render(<Entities />);
    expect(screen.getByRole("button", { name: "全部" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "宠物" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "健康" })).toBeInTheDocument();
  });

  it("filters entities by realm", async () => {
    const user = userEvent.setup();
    render(<Entities />);

    // All entities visible initially
    expect(screen.getByText("橘子")).toBeInTheDocument();
    expect(screen.getByText("爷爷的膝盖")).toBeInTheDocument();
    expect(screen.getByText("家用车")).toBeInTheDocument();

    // Click "健康" filter
    await user.click(screen.getByRole("button", { name: "健康" }));
    expect(screen.queryByText("橘子")).not.toBeInTheDocument();
    expect(screen.getByText("爷爷的膝盖")).toBeInTheDocument();
    expect(screen.queryByText("家用车")).not.toBeInTheDocument();

    // Click "全部" to reset
    await user.click(screen.getByRole("button", { name: "全部" }));
    expect(screen.getByText("橘子")).toBeInTheDocument();
    expect(screen.getByText("家用车")).toBeInTheDocument();
  });

  it("renders store entities when available", () => {
    useRealmsStore.setState({
      realms: [{ id: "r1", name: "宠物" }],
      entities: [
        { id: "e1", name: "小黑", type: "living", realmId: "r1", attributes: { breed: "田园犬" } },
      ],
    });

    render(<Entities />);
    expect(screen.getByText("小黑")).toBeInTheDocument();
    // Placeholder entities should not appear
    expect(screen.queryByText("橘子")).not.toBeInTheDocument();
  });

  it("toggles soul editor on edit click", async () => {
    const user = userEvent.setup();
    render(<Entities />);

    // Soul editor not visible initially
    expect(screen.queryByText(/性格设置/)).not.toBeInTheDocument();

    // Click edit on first entity
    const editButtons = screen.getAllByRole("button", { name: "编辑" });
    await user.click(editButtons[0]);

    // Soul editor should appear
    expect(screen.getByText(/性格设置/)).toBeInTheDocument();
  });
});
