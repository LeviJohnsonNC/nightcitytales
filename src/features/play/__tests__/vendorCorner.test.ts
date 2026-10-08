import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import { propInk } from "../courtyard/propTextures";
import { sceneryOccludes, type SceneryMask } from "../courtyard/sceneryOcclusion";
import { cartWindows } from "../courtyard/cartOcclusion";
import { isVendorStock } from "../courtyard/vendorStock";

const bounds = { x: 50, y: 100, displayWidth: 100, displayHeight: 100, depth: 2 };
const unit = { x: 50, y: 80, depth: 1, visible: true };
const mask = (cells = new Uint8Array(64 * 64).fill(1)): SceneryMask => ({
  cells,
  size: 64,
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  flipX: false,
});

describe("local cart occlusion", () => {
  it("keeps a cart opaque through empty canopy gaps but reveals a body behind a solid panel", () => {
    expect(sceneryOccludes(bounds, unit, 40)).toBe(true);
    expect(cartWindows(bounds, [unit], 40, mask(new Uint8Array(4096)))).toEqual([]);
    const windows = cartWindows(bounds, [unit], 40, mask());
    expect(windows).toHaveLength(1);
    expect(windows[0]!.rx).toBeLessThan(0.15);
    expect(windows[0]!.ry).toBeLessThan(0.3);
    expect(cartWindows(bounds, [{ ...unit, depth: 3 }], 40, mask())).toEqual([]);
    expect(cartWindows(bounds, [{ ...unit, visible: false }], 40, mask())).toEqual([]);
  });
  it("mirrors both ink lookup and local cutout coordinates with rotated atlas art", () => {
    const cells = Uint8Array.from({ length: 4096 }, (_, i) => (i % 64 < 32 ? 1 : 0));
    const left = { ...unit, x: 25 },
      right = { ...unit, x: 75 };
    expect(cartWindows(bounds, [right], 40, mask(cells))).toEqual([]);
    const normal = cartWindows(bounds, [left], 40, mask(cells));
    const flipped = cartWindows(bounds, [right], 40, { ...mask(cells), flipX: true });
    expect(flipped).toEqual(normal);
  });
  it("ignores a narrow frame post and resets when an actor leaves the footprint", () => {
    const cells = Uint8Array.from({ length: 4096 }, (_, i) => (i % 64 === 32 ? 1 : 0));
    expect(cartWindows(bounds, [unit], 40, mask(cells))).toEqual([]);
    expect(cartWindows(bounds, [{ ...unit, x: 200 }], 40, mask())).toEqual([]);
  });
  it("builds masks from opaque pixels without treating transparent padding as solid", () => {
    const rgba = new Uint8ClampedArray(64 * 64 * 4);
    for (let y = 16; y < 48; y++) for (let x = 8; x < 24; x++) rgba[(y * 64 + x) * 4 + 3] = 255;
    const ink = propInk(rgba, 64, 64);
    expect([ink.left, ink.top, ink.right, ink.bottom]).toEqual([0.125, 0.25, 0.375, 0.75]);
    expect(ink.cells.reduce((a, b) => a + b, 0)).toBe(16 * 32);
    expect(propInk(new Uint8ClampedArray(64 * 64 * 4), 64, 64)).toMatchObject({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    });
  });
});

it.each([0, 7, 8])(
  "applies vendor stock finish only to saved vendor steel cases, seed %i",
  (seed) => {
    const env = composeScene("intersection", seed).layout.arena.environment!;
    const before = JSON.stringify(env);
    const stock = env.props.filter((p) => isVendorStock(env, p));
    expect(stock).toHaveLength(1);
    expect(stock[0]!.art).toBe("cargo");
    expect(isVendorStock(undefined, stock[0])).toBe(false);
    expect(isVendorStock(env, { ...stock[0]!, clusterId: "unknown" })).toBe(false);
    expect(isVendorStock(env, { ...stock[0]!, art: "food-cart" })).toBe(false);
    expect(JSON.stringify(env)).toBe(before);
  },
);
