import { describe, expect, it } from "vitest";
import {
  FIXER_VENDOR,
  HAGGLE_APPROACHES,
  LEDGER_EVENTS,
  PLACE_SHOPS,
  getVendor,
  haggleReply,
  placeVendorId,
  purchaseEventData,
  soldEventData,
} from "@/engine";
import { counterNews } from "../../counterNews";
import { KEEPER_ART_READY, keeperImage, keeperSlug } from "../keeperArt";
import { initials } from "../KeeperFace";

describe("the face behind the counter", () => {
  it("names a different keeper at every shop in the atlas", () => {
    const names = PLACE_SHOPS.map((s) => getVendor(placeVendorId(s.vendor, s.place)).keeper?.name);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    expect(FIXER_VENDOR.keeper).toBeUndefined();
  });

  it("draws a portrait only once its file is listed, and initials until then", () => {
    expect(keeperSlug("gun_shop@d3")).toBe("gun_shop-d3");
    expect(keeperImage("gun_shop@d3", [])).toBeNull();
    expect(keeperImage("gun_shop@d3", ["gun_shop-d3"])).toBe(
      "/images/keepers/gun_shop-d3-512.webp",
    );
    for (const slug of KEEPER_ART_READY) expect(slug).toMatch(/^[a-z_]+-[a-z]\d+$/);
    expect(initials("Mama Ishii")).toBe("MI");
    expect(initials("Torrell and Chiang")).toBe("TA");
    expect(initials("Dot")).toBe("DO");
    expect(initials("Mr. Hachiman")).toBe("MH");
  });
});

describe("haggling, told", () => {
  it("offers three ways to put it and answers in the keeper's name", () => {
    expect(HAGGLE_APPROACHES).toHaveLength(3);
    const won = haggleReply({ won: true, seed: 7, name: "Toggle" });
    const lost = haggleReply({ won: false, seed: 7, name: "Toggle" });
    expect(won).toContain("Toggle");
    expect(lost).toContain("Toggle");
    expect(won).not.toBe(lost);
    expect(haggleReply({ won: true, seed: 7, name: "Toggle" })).toBe(won);
  });
});

describe("what the narrator hears about the counter", () => {
  const purchase = (itemId: string, quantity: number) => ({
    type: LEDGER_EVENTS.purchase,
    summary: `Bought ${itemId} for 500eb`,
    data: purchaseEventData({
      vendorId: "gun_shop@d3",
      kind: itemId === "basic_ammo" ? "ammunition" : "weapon",
      itemId,
      quantity,
      cost: 500,
      saved: 0,
      stockKey: "in",
      day: 3,
    }),
  });

  it("tells what was bought, from whom, since the narrator last spoke — and no price", () => {
    const lines = counterNews([
      purchase("smg", 1),
      { type: "life_narration", summary: "…" },
      purchase("heavy_pistol", 1),
      purchase("basic_ammo", 3),
      { type: "haggle", data: { vendorId: "gun_shop@d3", won: true } },
    ]);
    expect(lines).toEqual([
      "Bought Heavy Pistol from Toggle at Toggle's Temple.",
      "Bought Basic Ammunition (more than one) from Toggle at Toggle's Temple.",
      "Talked Toggle at Toggle's Temple down on the price.",
    ]);
    for (const line of lines) expect(line).not.toMatch(/\d|eb\b/);
  });

  it("tells a sale too, and says nothing when nothing happened at a counter", () => {
    const sold = {
      type: LEDGER_EVENTS.sold,
      data: soldEventData({
        vendorId: "street@o3",
        kind: "weapon",
        itemId: "heavy_pistol",
        quantity: 1,
        paid: 100,
        day: 2,
      }),
    };
    expect(counterNews([sold])).toEqual([
      "Sold their Heavy Pistol to Mama Ishii at Ganymede Street Market.",
    ]);
    expect(counterNews([{ type: "life_narration" }])).toEqual([]);
  });
});
