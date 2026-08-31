import { describe, expect, it } from "vitest";
import { carriedKit } from "../carriedKit";
import type { CampaignCyberware } from "@/lib/backend";

/**
 * Campaigns created before package labels were resolved to catalog ids hold
 * printed names like "Neural Link". Rendering must survive them.
 */
describe("carriedKit with legacy chrome rows", () => {
  const legacy = [
    {
      id: "row-1",
      campaign_id: "c",
      item_id: "Neural Link",
      install_location: null,
      humanity_loss_rolled: 0,
      foundational_for: null,
      installed_day: 1,
      installed_by_npc_id: null,
      source_character_cyberware_id: null,
      request_id: null,
      created_at: "",
    },
  ] as unknown as CampaignCyberware[];

  it("does not throw and shows the stored value", () => {
    const groups = carriedKit([], legacy);
    const chrome = groups.find((g) => g.kind === "cyberware");
    expect(chrome?.lines[0]?.name).toBe("Neural Link");
  });

  it("names canonical ids from the catalog", () => {
    const groups = carriedKit([], [{ ...legacy[0]!, item_id: "neural_link" }]);
    expect(groups.find((g) => g.kind === "cyberware")?.lines[0]?.name).toBe("Neural Link");
  });
});
