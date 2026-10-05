import { existsSync, statSync } from "node:fs";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { attachmentPoint, composeScene } from "@/engine";
import { battlefieldProjection } from "../battlefieldProjection";
import {
  awningFootprint,
  facePoint,
  paintAwning,
  paintStorefrontFace,
  paintStorefrontGround,
  storefrontFor,
  storefrontLights,
  streetLamp,
  STOREFRONT_ART_FILES,
  type StorefrontArt,
} from "../courtyard/storefront";
import { STOREFRONT_LEVELS, STOREFRONT_PACK } from "../courtyard/storefrontPack";
import { INTERSECTION_NIGHT, lightAt } from "../courtyard/nightLighting";

const arena = composeScene("intersection", 7).layout.arena;
const env = arena.environment!;
const shop = env.structures.find((s) => s.id === "building_0")!;
const { project, pixelsPerMetre } = battlefieldProjection(arena.extent.width, arena.extent.height);
const sf = storefrontFor(shop, env)!;

const tile = (w: number, h: number) =>
  ({ width: w, height: h }) as unknown as CanvasImageSource & {
    width: number;
    height: number;
  };
const art: StorefrontArt = {
  window: tile(768, 512),
  awning: tile(512, 512),
  wear: tile(512, 768),
  kanji: tile(1024, 256),
};

/** A context that records what is drawn and which images were used. */
function recorder() {
  const log: string[] = [];
  const images: unknown[] = [];
  const target = {
    createPattern: () => ({ setTransform: () => undefined }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  } as Record<string, unknown>;
  const ctx = new Proxy(target, {
    get: (t, name: string) => {
      if (name in t) return t[name];
      return (...args: unknown[]) => {
        log.push(`${name}${name === "clip" ? `(${String(args[0] ?? "")})` : ""}`);
        if (name === "drawImage") images.push(args[0]);
      };
    },
    set: (_t, name: string, value: unknown) => {
      log.push(`set:${name}=${String(value)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log, images };
}

describe("storefront: read from the saved scene", () => {
  it("finds the shop by its saved awning and entrance", () => {
    expect(sf.edge).toBe("north");
    expect(sf.length).toBe(20);
    expect(sf.door).toBe(1);
    expect(sf.bays).toEqual([3.5, 6.5, 9.5, 12.5, 15.5]);
    // building_0_middle stands against the face from x 32: those bays face its wall
    expect(sf.litBays).toEqual([3.5, 6.5]);
    expect(sf.lamp).toEqual(env.dressing.find((d) => d.id === "shop_lamp_detail_0")!.position);
  });

  it("is not a storefront where the camera cannot see the awning, or for another building", () => {
    expect(
      storefrontFor(
        env.structures.find((s) => s.style === "workshop")!,
        env,
      ),
    ).toBeUndefined();
    // seed 0 is a quarter-turn layout: its awning faces a wall the camera never sees
    const turned = composeScene("intersection", 0).layout.arena.environment!;
    const turnedShop = turned.structures.find((s) =>
      s.attachments?.some((a) => a.id === "shop-canopy"),
    )!;
    expect(["north", "east"]).not.toContain(turnedShop.attachments![0]!.edge);
    expect(storefrontFor(turnedShop, turned)).toBeUndefined();
  });
});

describe("storefront: geometry is the scene's own", () => {
  const at = facePoint(sf, project, pixelsPerMetre);

  it("puts the door at the saved entrance, on the wall line, at the right scale", () => {
    const entrance = env.entrances!.find((e) => e.structureId === shop.id)!;
    const foot = at(sf.door, 0, 0);
    const onWall = project({ x: entrance.position.x, y: shop.rect.y });
    expect(foot.x).toBeCloseTo(onWall.x);
    expect(foot.y).toBeCloseTo(onWall.y);
    // a metre up is a metre of the scene's scale, straight up the screen
    const up = at(sf.door, 0, 1);
    expect(up.x).toBeCloseTo(foot.x);
    expect(foot.y - up.y).toBeCloseTo(pixelsPerMetre);
  });

  it("puts the awning footprint where the saved attachment is, and sorts by it", () => {
    const foot = awningFootprint(sf);
    expect(foot).toEqual({ x: 24, y: 2.5, width: 4, height: 1.5 });
    const a = sf.awning;
    const near = attachmentPoint(shop, a, 0, 0);
    const far = attachmentPoint(shop, a, a.span, a.projection);
    expect(near).toEqual({ x: foot.x, y: foot.y + foot.height });
    expect(far).toEqual({ x: foot.x + foot.width, y: foot.y });
  });
});

describe("storefront: painting", () => {
  beforeAll(() => {
    // the sign's mask is tinted on a scratch canvas; node has none
    vi.stubGlobal("document", {
      createElement: () => ({ width: 0, height: 0, getContext: () => recorder().ctx }),
    });
  });
  const base = { sf, project, ppm: pixelsPerMetre, art, pass: "albedo" as const };
  const lit = (log: string[]) => log.some((l) => l === "set:globalCompositeOperation=lighter");

  it("paints the whole face, with its sign, only when asked for the whole face", () => {
    const whole = recorder();
    paintStorefrontFace({ ctx: whole.ctx, ...base });
    expect(whole.images.filter((i) => i === art.window)).toHaveLength(sf.bays.length);
    expect(whole.images.filter((i) => i === art.wear)).toHaveLength(1);
    // the kanji mask is drawn tinted, as dull glass, in the albedo
    expect(whole.images.length).toBe(sf.bays.length + 2);
  });

  it("paints a cutaway piece only with what that piece carries, up to its height", () => {
    const door = recorder();
    paintStorefrontFace({ ctx: door.ctx, ...base, clip: { s0: 0.2, s1: 1.8, zMax: 2.4 } });
    expect(door.images.filter((i) => i === art.window)).toHaveLength(0);
    expect(door.images.filter((i) => i === art.wear)).toHaveLength(1);
    // the sign and fascia are above a retained piece: not painted into it
    expect(door.log.filter((l) => l === "drawImage")).toHaveLength(1);

    const bay = recorder();
    paintStorefrontFace({ ctx: bay.ctx, ...base, clip: { s0: 4, s1: 6, zMax: 2.4 } });
    expect(bay.images.filter((i) => i === art.window)).toHaveLength(1);
    expect(bay.images.filter((i) => i === art.wear)).toHaveLength(0);
  });

  it("keeps light out of the albedo: every pass draws only its own part", () => {
    for (const pass of ["albedo", "light", "glow"] as const) {
      const face = recorder();
      paintStorefrontFace({ ctx: face.ctx, ...base, pass });
      const ground = recorder();
      paintStorefrontGround({
        ctx: ground.ctx,
        sf,
        project,
        ppm: pixelsPerMetre,
        structures: env.structures,
        pass,
      });
      // the renderer composites the passes; no painter sets its own blend
      expect(lit(face.log)).toBe(false);
      expect(lit(ground.log)).toBe(false);
      // the window art and shutter wear belong to the albedo alone
      expect(face.images.includes(art.window)).toBe(pass === "albedo");
      expect(face.images.includes(art.wear)).toBe(pass === "albedo");
    }
    // the sign's tubes are lit only in the glow pass, and only where the fascia is painted
    const glow = recorder();
    paintStorefrontFace({ ctx: glow.ctx, ...base, pass: "glow" });
    expect(glow.log.some((l) => l.startsWith("set:shadowBlur"))).toBe(true);
    const piece = recorder();
    paintStorefrontFace({
      ctx: piece.ctx,
      ...base,
      pass: "glow",
      clip: { s0: 0.2, s1: 1.8, zMax: 2.4 },
    });
    expect(piece.log.some((l) => l.startsWith("set:shadowBlur"))).toBe(false);
  });

  it("keeps light and shade off the buildings: the ground is clipped around every footprint", () => {
    for (const pass of ["albedo", "light"] as const) {
      const g = recorder();
      paintStorefrontGround({
        ctx: g.ctx,
        sf,
        project,
        ppm: pixelsPerMetre,
        structures: env.structures,
        pass,
      });
      expect(g.log).toContain("clip(evenodd)");
    }
  });

  it("paints the canopy as a sloped plane from the saved heights, its sign on the valance", () => {
    const r = recorder();
    paintAwning({ ctx: r.ctx, ...base });
    expect(r.log).toContain("fill");
    expect(STOREFRONT_LEVELS.awningWall).toBe(sf.awning.height);
    expect(r.images.length).toBeGreaterThan(0);
  });
});

describe("storefront: its lights", () => {
  const lamp = streetLamp(sf)!;
  const lights = storefrontLights(sf, INTERSECTION_NIGHT);

  it("keeps the streetlight on its saved position and hangs the head over the pavement", () => {
    expect(lamp.base).toEqual(sf.lamp);
    // out from the north face is -y; the head is the arm's length out
    expect(lamp.head.x).toBeCloseTo(sf.lamp!.x);
    expect(lamp.head.y).toBeCloseTo(sf.lamp!.y - INTERSECTION_NIGHT.lamp.arm);
    expect(lamp.headZ).toBeLessThan(lamp.poleZ);
  });

  it("centres the lamp's pool under its head, never independently of it", () => {
    const pool = lights.find(
      (l) => l.kind === "pool" && l.radius === INTERSECTION_NIGHT.lamp.radius,
    );
    expect(pool).toBeDefined();
    expect(pool!.kind === "pool" && pool!.centre).toEqual(lamp.head);
  });

  it("throws one spill per lit window, and none from a window against a neighbour", () => {
    expect(lights.filter((l) => l.kind === "spill")).toHaveLength(sf.litBays.length);
  });

  it("lights the pavement in front of the shop and nothing inside a building", () => {
    const front = { x: shop.rect.x + 4.6, y: shop.rect.y - 1 };
    const inside = { x: shop.rect.x + 4.6, y: shop.rect.y + 1 };
    expect(Math.max(...lightAt(lights, env.structures, front))).toBeGreaterThan(0.2);
    expect(lightAt(lights, env.structures, inside)).toEqual([0, 0, 0]);
  });
});

describe("storefront: the returned art", () => {
  it("ships a runtime file for each image, at the guide's proportions", async () => {
    const by = Object.fromEntries(STOREFRONT_PACK.map((a) => [a.id, a]));
    const expected = {
      window: by["window-interior"]!,
      awning: by["awning-fabric"]!,
      wear: by["shutter-wear"]!,
    } as const;
    for (const key of ["window", "awning", "wear"] as const) {
      const file = `public${STOREFRONT_ART_FILES[key]}`;
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeLessThan(260 * 1024);
      const meta = await sharp(file).metadata();
      const guide = expected[key];
      expect(meta.width! / meta.height!).toBeCloseTo(guide.canvas.w / guide.canvas.h, 3);
      // only the shutter wear is keyed, so only it has transparency
      expect(meta.hasAlpha).toBe(guide.key !== null);
    }
    expect(existsSync(`public${STOREFRONT_ART_FILES.kanji}`)).toBe(true);
  });
});
