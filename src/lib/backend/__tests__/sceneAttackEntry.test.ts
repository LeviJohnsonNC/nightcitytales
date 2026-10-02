import { beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../client", () => ({ backendClient: { rpc } }));
import { startEncounter, type StartEncounterPayload } from "../encounters";
const payload: StartEncounterPayload = {
  campaign_id: "c",
  order_ids: [],
  combatants: [],
  scene_ref: { id: "scene", revision: 0 },
};
beforeEach(() => rpc.mockReset());
it("keeps button entry on the existing saved-scene RPC", async () => {
  rpc.mockResolvedValue({ data: "e", error: null });
  expect(await startEncounter(payload)).toBe("e");
  expect(rpc.mock.calls[0]?.[0]).toBe("start_persisted_scene_encounter");
});
it("does not fall back to an older RPC that would drop the opening intent", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "function not found" } });
  await expect(
    startEncounter({
      ...payload,
      initiating_intent: { version: 1, input: "open fire", targetKey: null, weapon: null },
    }),
  ).rejects.toThrow("function not found");
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[0]?.[0]).toBe("start_scene_attack_encounter");
});
