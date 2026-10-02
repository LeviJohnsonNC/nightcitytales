import { beforeEach, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ intercept: vi.fn(), life: vi.fn(), job: vi.fn(), append: vi.fn() }));
vi.mock("../sceneOps", () => ({ trySceneAttack: io.intercept }));
vi.mock("@/features/life/lifeTurn.server", () => ({ lifeTurnFn: io.life }));
vi.mock("@/features/gm/gmTurn.server", () => ({ gmTurnFn: io.job }));
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<object>()),
  appendCampaignEvent: io.append,
}));
import { liveTurn, type LifeBundle } from "@/features/life/lifeOps";
import { narrate, type PlayBundle } from "@/features/play/playOps";
beforeEach(() => {
  vi.clearAllMocks();
  io.intercept.mockResolvedValue(true);
});
it("routes a Life attack before logging input, consulting oracles, or asking the narrator", async () => {
  await liveTurn({ campaign: { id: "c" } } as LifeBundle, "open fire");
  expect(io.intercept).toHaveBeenCalledWith("c", "open fire");
  expect(io.append).not.toHaveBeenCalled();
  expect(io.life).not.toHaveBeenCalled();
});
it("routes a Job attack through the same entry before normal narration", async () => {
  await narrate({ campaign: { id: "c" }, encounter: null } as PlayBundle, "shoot the rifleman");
  expect(io.intercept).toHaveBeenCalledWith("c", "shoot the rifleman");
  expect(io.append).not.toHaveBeenCalled();
  expect(io.job).not.toHaveBeenCalled();
});
it("does not narrate success when the scene entry fails", async () => {
  io.intercept.mockRejectedValue(new Error("scene changed"));
  await expect(liveTurn({ campaign: { id: "c" } } as LifeBundle, "open fire")).rejects.toThrow(
    "scene changed",
  );
  expect(io.append).not.toHaveBeenCalled();
  expect(io.life).not.toHaveBeenCalled();
});
