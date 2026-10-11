import { describe, expect, it } from "vitest";
import { FIXER_VENDOR, PLACE_SHOPS, getVendor, placeVendorId, shopGreeting } from "@/engine";

describe("what it is like to walk up to a seller", () => {
  it("gives every shop in the atlas two short paragraphs of its own", () => {
    for (const shop of PLACE_SHOPS) {
      const vendor = getVendor(placeVendorId(shop.vendor, shop.place));
      expect(vendor.scene, vendor.label).toHaveLength(2);
      for (const paragraph of vendor.scene) {
        expect(paragraph.split(/\s+/).length, vendor.label).toBeLessThanOrEqual(60);
      }
    }
    expect(FIXER_VENDOR.scene.length).toBeGreaterThan(0);
  });

  it("puts no price, stock count or number in a scene: those are the counter's", () => {
    for (const shop of PLACE_SHOPS) {
      for (const paragraph of getVendor(placeVendorId(shop.vendor, shop.place)).scene) {
        expect(paragraph, shop.label).not.toMatch(/\d|\beb\b|eurobuck/i);
      }
    }
  });

  it("is greeted by what the engine knows about the character there", () => {
    const stranger = shopGreeting({ knowsYou: false, backRoomOpen: false });
    const known = shopGreeting({ knowsYou: true, backRoomOpen: false });
    const back = shopGreeting({ knowsYou: true, backRoomOpen: true });
    expect(new Set([stranger, known, back]).size).toBe(3);
  });
});
