import { expect, it, vi } from "vitest";
const runNpcTurns = vi.hoisted(() =>
  vi.fn(async (_campaign, _beat, live) => ({ live, lines: [] })),
);
const settleNpcTurns = vi.hoisted(() => vi.fn(async () => ({ status: "", owed: null })));
vi.mock("../combatFlow", async (original) => ({
  ...(await original<object>()),
  runNpcTurns,
  settleNpcTurns,
}));
import { endPlayerTurn } from "../combatOps";

it("resumes the current NPC after reload instead of advancing past it", async () => {
  const live = {
    id: "fight",
    origin: { version: 1 },
    state: {
      status: "active",
      order: ["h", "p"],
      activeIndex: 0,
      combatants: { h: { id: "h", isPlayer: false }, p: { id: "p", isPlayer: true } },
    },
  };
  await endPlayerTurn({ campaign: { id: "c" }, beat: null, encounter: live } as never);
  expect(runNpcTurns).toHaveBeenCalledWith("c", null, live, "current");
  expect(settleNpcTurns).toHaveBeenCalledWith("c", null, live);
});
