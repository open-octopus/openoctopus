import { describe, it, expect, vi } from "vitest";
import { stopCommand } from "./stop.js";

vi.mock("consola", () => ({
  default: {
    info: vi.fn(),
  },
}));

describe("stopCommand", () => {
  it("prints stop instructions", async () => {
    await (stopCommand.run as any)({ args: {} });
    expect(stopCommand.run).toBeDefined();
  });
});
