import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useFamilyStore } from "../stores/family";
import { Members } from "./Members";

describe("Members page", () => {
  beforeEach(() => {
    useFamilyStore.setState({ members: [], routeEvents: [] });
  });

  it("renders placeholder members when store is empty", () => {
    render(<Members />);
    expect(screen.getByText(/爸爸（王明）/)).toBeInTheDocument();
    expect(screen.getByText(/妈妈（李雪）/)).toBeInTheDocument();
    expect(screen.getByText(/爷爷（王德）/)).toBeInTheDocument();
    expect(screen.getByText(/女儿（王小雪）/)).toBeInTheDocument();
  });

  it("renders store members when available", () => {
    useFamilyStore.setState({
      members: [
        { id: "m1", name: "张三", role: "adult", channels: ["Telegram"], watchedRealms: ["财务"] },
      ],
      routeEvents: [],
    });

    render(<Members />);
    expect(screen.getByText("张三")).toBeInTheDocument();
    expect(screen.getByText(/Telegram/)).toBeInTheDocument();
    // Placeholder should not appear
    expect(screen.queryByText(/王明/)).not.toBeInTheDocument();
  });

  it("shows role labels correctly", () => {
    render(<Members />);
    expect(screen.getByText("成人")).toBeInTheDocument();
    expect(screen.getByText("管理员")).toBeInTheDocument();
    expect(screen.getByText("老人")).toBeInTheDocument();
    expect(screen.getByText("儿童")).toBeInTheDocument();
  });

  it("renders invite button", () => {
    render(<Members />);
    expect(screen.getByRole("button", { name: /邀请成员/ })).toBeInTheDocument();
  });
});
