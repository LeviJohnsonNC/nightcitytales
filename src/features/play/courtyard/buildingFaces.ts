/**
 * The architectural completion pilot: the intersection's homes and sheds, finished
 * with code and the materials already in the pack, so the residential block and the
 * workshops belong to the same street as the finished shop.
 *
 * Presentation only, and on intersection scenes with materials only (a missing tile
 * is the old drawing). Every opening is the one the generic face always drew, at the
 * same place and size; nothing here adds collision, moves a wall, an entrance or a
 * route, or changes sorting. The two uses are kept apart on purpose:
 *
 *   residential  painted render; windows with a reveal, a frame, a projecting sill and
 *                glass behind which somebody lives — a blind, curtains, nets, a lamp or
 *                nothing, chosen by the window alone, never the shop's stocked interior
 *   industrial   painted-metal cladding in sheets, a fascia, a plinth; steel-framed
 *                wired glass in divided lights; the loading door a roller shutter in
 *                its guides under its coil box
 */
import type { Point, SceneEnvironment, SceneStructure } from "@/engine";
import type { MaterialKey, MaterialSet } from "./surfaceMaterials";
import { SURFACE_MATERIALS, fillMaterial, wallBasis } from "./surfaceMaterials";
import { edgeFrame, hash, type Edge } from "./frontage";
import { facadeOpenings, drawOnto } from "./architectureArt";
import type { ArchitectureArt } from "./architecturePack";

type Project = (p: Point) => Point;
export type BuildingUse = "residential" | "industrial";

/** What a mass is used for, for the pilot; anything else keeps its drawing. */
export function buildingUse(structure: SceneStructure): BuildingUse | undefined {
  if (structure.style === "residential") return "residential";
  if (structure.style === "workshop" || structure.style === "warehouse") return "industrial";
  return undefined;
}

/** The wall a use is built of, from the pack: render for homes, sheet metal for sheds. */
export const USE_WALL: Record<BuildingUse, MaterialKey> = {
  residential: "painted-render",
  industrial: "painted-metal",
};

export type Occupancy = "blind" | "curtains" | "nets" | "lamp" | "dark";

export interface Opening {
  kind: "window" | "bay" | "clerestory" | "light";
  /** Metres along the face, and metres above the ground. */
  s0: number;
  s1: number;
  z0: number;
  z1: number;
  /** Who lives behind a home's window; absent on a shed. */
  occupancy?: Occupancy;
  /** A stable number in [0, 1) for this opening alone, for quiet variation. */
  seed: number;
}

/** Window and bay dimensions are the generic face's, unchanged (`paintBuilding`). */
const WINDOW = { width: 1.4, inset: 0.2, height: 1.2 } as const;
const BAY = { width: 2.2 } as const;

function occupancyOf(seed: number): Occupancy {
  // most homes have something at the glass; a few are dark, fewer still lit
  return seed < 0.3
    ? "blind"
    : seed < 0.55
      ? "curtains"
      : seed < 0.72
        ? "nets"
        : seed < 0.9
          ? "dark"
          : "lamp";
}

/**
 * Every opening on one camera-facing face, where the generic face put it: storeys
 * from 3.8 m every 3 m on a home, a single clerestory under a shed's eaves, and the
 * ground-floor bays between the doors.
 */
export function faceOpenings(
  structure: SceneStructure,
  edge: Edge,
  entrances: SceneEnvironment["entrances"],
): Opening[] {
  const use = buildingUse(structure);
  if (!use) return [];
  const industrial = use === "industrial";
  const { length, bays, doors } = facadeOpenings(structure, entrances, edge);
  const r = structure.rect;
  const seedOf = (s: number, z: number) => hash(r.x, r.y, edge === "north" ? 1 : 2, s, z);
  const out: Opening[] = [];
  const levels = industrial
    ? [Math.max(1.8, structure.height - 0.9)]
    : Array.from({ length: Math.max(1, Math.floor(structure.height / 3)) }, (_, i) => 3.8 + i * 3);
  const tall = industrial ? 0.45 : WINDOW.height;
  for (const level of levels.filter((l) => l + tall < structure.height))
    for (let i = 0; i < length; i += industrial ? 2 : 4) {
      const s0 = i + WINDOW.inset;
      const seed = seedOf(s0, level);
      out.push({
        kind: industrial ? "clerestory" : "window",
        s0,
        s1: s0 + WINDOW.width,
        z0: level,
        z1: level + tall,
        seed,
        ...(industrial ? {} : { occupancy: occupancyOf(seed) }),
      });
    }
  for (const start of bays) {
    const z0 = industrial ? 1.25 : 0.65,
      z1 = Math.min(2.35, structure.height - 0.3);
    if (z1 <= z0) continue;
    const seed = seedOf(start, 0);
    out.push({
      kind: industrial ? "light" : "bay",
      s0: start,
      s1: start + BAY.width,
      z0,
      z1,
      seed,
      // a ground-floor flat keeps its privacy: never a dark, open room on the street
      ...(industrial
        ? {}
        : { occupancy: (["nets", "blind", "curtains"] as const)[Math.floor(seed * 3)] }),
    });
  }
  // A shed's clerestory and its ground-floor lights were always laid out apart and
  // overlap where both fall: a pane that would run into a light is not glazed twice.
  // Nor does one run behind a loading door's coil box or its guides.
  const taken = [
    ...out.filter((o) => o.kind === "light"),
    ...doors.map((d) => ({ s0: d - 1.1, s1: d + 1.1, z0: 0, z1: structure.height })),
  ];
  return out.filter(
    (o) =>
      o.kind !== "clerestory" ||
      !taken.some((l) => o.s0 < l.s1 && l.s0 < o.s1 && o.z0 < l.z1 && l.z0 < o.z1),
  );
}

/* ------------------------------------------------------------------ painting */

function poly(ctx: CanvasRenderingContext2D, pts: readonly Point[], fill: string) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function stroke(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function shade(
  ctx: CanvasRenderingContext2D,
  pts: readonly Point[],
  from: Point,
  to: Point,
  stops: [number, string][],
) {
  const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  for (const [t, c] of stops) g.addColorStop(t, c);
  poly(ctx, pts, g as unknown as string);
}

/** A face as a drawing surface: `s` along it, `out` from the wall (negative is in). */
export function facePainter(structure: SceneStructure, edge: Edge, project: Project, ppm: number) {
  const f = edgeFrame(structure.rect, edge);
  const at = (s: number, out: number, z: number) => {
    const p = project(f.world(s, out));
    return { x: p.x, y: p.y - z * ppm };
  };
  const quad = (s0: number, s1: number, z0: number, z1: number, out = 0) => [
    at(s0, out, z0),
    at(s1, out, z0),
    at(s1, out, z1),
    at(s0, out, z1),
  ];
  return { at, quad, length: f.length };
}

/** A metre of line on screen, so strokes keep their physical weight at any scale. */
const px = (ppm: number, metres: number) => Math.max(0.6, metres * ppm);

/** Curtain and blind cloths: muted, domestic, none of them the shop's colours. */
const CLOTH = ["#8a7562", "#6c7569", "#9a8a70", "#76606a", "#5f6b74"];

export function paintHomeWindow(
  ctx: CanvasRenderingContext2D,
  face: ReturnType<typeof facePainter>,
  ppm: number,
  o: Opening,
  art?: ArchitectureArt,
) {
  const { at, quad } = face;
  const { s0, s1, z0, z1 } = o;
  const depth = HOME_DEPTH;
  const frame = 0.05;
  // the reveal: render returning into the opening, and the glass set back in it
  poly(ctx, quad(s0, s1, z0, z1), "#26221e");
  const g0 = s0 + frame,
    g1 = s1 - frame,
    h0 = z0 + frame,
    h1 = z1 - frame;
  shade(ctx, quad(g0, g1, h0, h1, -depth), at(g0, -depth, h1), at(g0, -depth, h0), [
    [0, "#33414b"],
    [1, "#1c252c"],
  ]);
  // who lives here, behind the glass
  const width = g1 - g0,
    height = h1 - h0;
  const cloth = CLOTH[Math.floor(o.seed * 997) % CLOTH.length]!;
  const occupancy = o.occupancy ?? "dark";
  if (occupancy === "lamp") {
    shade(ctx, quad(g0, g1, h0, h1, -depth), at(g0, -depth, h1), at(g0, -depth, h0), [
      [0, "#7e6446"],
      [1, "#4a3a2b"],
    ]);
  }
  if (occupancy === "blind") {
    const down = 0.25 + ((o.seed * 7.3) % 1) * 0.45;
    const bottom = h1 - height * down;
    shade(ctx, quad(g0, g1, bottom, h1, -depth), at(g0, -depth, h1), at(g0, -depth, bottom), [
      [0, "#b6aa92"],
      [1, "#a19580"],
    ]);
    stroke(ctx, at(g0, -depth, bottom), at(g1, -depth, bottom), "#6f6656", px(ppm, 0.03));
  }
  if (occupancy === "curtains" || occupancy === "lamp") {
    const side = width * (0.22 + ((o.seed * 13.1) % 1) * 0.12);
    for (const [a, b] of [
      [g0, g0 + side],
      [g1 - side, g1],
    ] as const) {
      poly(ctx, quad(a, b, h0, h1, -depth), cloth);
      for (let s = a + 0.07; s < b - 0.03; s += 0.09)
        stroke(ctx, at(s, -depth, h0), at(s, -depth, h1), "rgba(0,0,0,.18)", px(ppm, 0.015));
    }
  }
  if (occupancy === "nets") {
    poly(ctx, quad(g0, g1, h0, h0 + height * 0.7, -depth), "rgba(222,216,200,.26)");
    for (let s = g0 + 0.05; s < g1; s += 0.07)
      stroke(
        ctx,
        at(s, -depth, h0),
        at(s, -depth, h0 + height * 0.7),
        "rgba(255,255,255,.07)",
        px(ppm, 0.012),
      );
  }
  // Upper windows only: the room is registered to 1.3 × 1.1 m of glass.
  // Ground-floor privacy bays retain their own proportions and procedural cloth.
  const painted = homeInterior(o, art);
  if (painted) {
    ctx.save();
    poly(ctx, quad(g0, g1, h0, h1, -depth), "#292b2a");
    ctx.clip();
    drawOnto(
      ctx,
      painted as Parameters<typeof drawOnto>[1],
      at(g0, -depth, h1),
      at(g1, -depth, h1),
      at(g0, -depth, h0),
    );
    ctx.restore();
  }
  // a restrained sky in the glass, across the upper corner
  poly(
    ctx,
    [at(g0, -depth, h1), at(g0 + width * 0.45, -depth, h1), at(g0, -depth, h1 - height * 0.55)],
    "rgba(190,205,214,.08)",
  );
  // the frame: painted timber, a mullion, and a transom on a wide ground-floor bay
  const bar = "#c9c1b0";
  const w = px(ppm, 0.045);
  for (const [a, b] of [
    [at(g0, -depth, h0), at(g1, -depth, h0)],
    [at(g0, -depth, h1), at(g1, -depth, h1)],
    [at(g0, -depth, h0), at(g0, -depth, h1)],
    [at(g1, -depth, h0), at(g1, -depth, h1)],
  ] as const)
    stroke(ctx, a, b, bar, w);
  const mullions = o.kind === "bay" ? [1 / 3, 2 / 3] : [0.5];
  for (const t of mullions) {
    const s = g0 + width * t;
    stroke(ctx, at(s, -depth, h0), at(s, -depth, h1), bar, w * 0.8);
  }
  if (o.kind === "bay") {
    const z = h0 + height * 0.74;
    stroke(ctx, at(g0, -depth, z), at(g1, -depth, z), bar, w * 0.8);
  }
  // the near jamb's depth, and the head's shade over the set-back glass
  poly(ctx, [at(s0, 0, z0), at(s0, -depth, z0), at(s0, -depth, z1), at(s0, 0, z1)], "#16130f");
  shade(ctx, quad(s0, s1, z1 - 0.28, z1, -depth), at(s0, -depth, z1), at(s0, -depth, z1 - 0.28), [
    [0, "rgba(0,0,0,.45)"],
    [1, "rgba(0,0,0,0)"],
  ]);
  // the sill: a stone ledge, proud of the wall, a little wider than the opening
  // A built stone head, with a shaded underside rather than another thin outline.
  poly(ctx, quad(s0 - 0.1, s1 + 0.1, z1, z1 + 0.14, 0.06), "#938878");
  poly(
    ctx,
    [at(s0 - 0.1, 0, z1), at(s1 + 0.1, 0, z1), at(s1 + 0.1, 0.06, z1), at(s0 - 0.1, 0.06, z1)],
    "#494238",
  );
  const lip = 0.18;
  poly(
    ctx,
    [at(s0 - 0.06, 0, z0), at(s1 + 0.06, 0, z0), at(s1 + 0.06, lip, z0), at(s0 - 0.06, lip, z0)],
    "#bdb3a1",
  );
  poly(ctx, quad(s0 - 0.06, s1 + 0.06, z0 - 0.14, z0, lip), "#8c8476");
  shade(
    ctx,
    quad(s0 - 0.06, s1 + 0.06, z0 - 0.38, z0 - 0.14),
    at(s0, 0, z0 - 0.14),
    at(s0, 0, z0 - 0.38),
    [
      [0, "rgba(0,0,0,.26)"],
      [1, "rgba(0,0,0,0)"],
    ],
  );
}

export function paintShedGlazing(
  ctx: CanvasRenderingContext2D,
  face: ReturnType<typeof facePainter>,
  ppm: number,
  o: Opening,
) {
  const { at, quad } = face;
  const { s0, s1, z0, z1 } = o;
  const depth = 0.08;
  poly(ctx, quad(s0, s1, z0, z1), "#151a1c");
  // wired glass: milky, pale, nothing to be seen through it
  shade(ctx, quad(s0, s1, z0, z1, -depth), at(s0, -depth, z1), at(s0, -depth, z0), [
    [0, "#7d8a87"],
    [1, "#5c6865"],
  ]);
  const cols = o.kind === "light" ? 6 : 4,
    rows = o.kind === "light" ? 2 : 1;
  const pw = (s1 - s0) / cols,
    ph = (z1 - z0) / rows;
  // one pane in a few is sheeted over or hinged open: a working building
  const odd = o.seed < 0.45 ? Math.floor(((o.seed * 31) % 1) * cols * rows) : -1;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const a = s0 + c * pw,
        b = a + pw,
        lo = z0 + r * ph,
        hi = lo + ph;
      if (c + r * cols === odd)
        poly(ctx, quad(a, b, lo, hi, -depth), o.seed < 0.2 ? "#1d2427" : "#47504f");
      // the wire in the glass, read as a faint grain
      for (let s = a + 0.06; s < b; s += 0.06)
        stroke(ctx, at(s, -depth, lo), at(s, -depth, hi), "rgba(30,40,40,.08)", px(ppm, 0.008));
    }
  // steel glazing bars
  const bar = "#2b3438";
  const w = px(ppm, 0.035);
  for (let c = 0; c <= cols; c++) {
    const s = s0 + c * pw;
    stroke(ctx, at(s, -depth, z0), at(s, -depth, z1), bar, c === 0 || c === cols ? w * 1.4 : w);
  }
  for (let r = 0; r <= rows; r++) {
    const z = z0 + r * ph;
    stroke(ctx, at(s0, -depth, z), at(s1, -depth, z), bar, r === 0 || r === rows ? w * 1.4 : w);
  }
  // the near jamb, the head's shade and a pressed-metal sill flashing
  poly(ctx, [at(s0, 0, z0), at(s0, -depth, z0), at(s0, -depth, z1), at(s0, 0, z1)], "#0f1315");
  shade(ctx, quad(s0, s1, z1 - 0.18, z1, -depth), at(s0, -depth, z1), at(s0, -depth, z1 - 0.18), [
    [0, "rgba(0,0,0,.42)"],
    [1, "rgba(0,0,0,0)"],
  ]);
  poly(
    ctx,
    [
      at(s0 - 0.03, 0, z0),
      at(s1 + 0.03, 0, z0),
      at(s1 + 0.03, 0.05, z0 - 0.02),
      at(s0 - 0.03, 0.05, z0 - 0.02),
    ],
    "#8e979a",
  );
  shade(
    ctx,
    quad(s0 - 0.03, s1 + 0.03, z0 - 0.2, z0 - 0.02),
    at(s0, 0, z0 - 0.02),
    at(s0, 0, z0 - 0.2),
    [
      [0, "rgba(0,0,0,.24)"],
      [1, "rgba(0,0,0,0)"],
    ],
  );
}

/**
 * A shed's wall: the sheets' joints, a plinth it stands on and a fascia under the
 * eaves. Lines only; the material under them is laid by the caller.
 */
export function paintShedWall(
  ctx: CanvasRenderingContext2D,
  face: ReturnType<typeof facePainter>,
  ppm: number,
  height: number,
  materials?: MaterialSet,
  basis?: ReturnType<typeof wallBasis>,
) {
  const { at, quad, length } = face;
  // sheets of profiled metal, a little over a metre wide
  for (let s = 1.05; s < length - 0.2; s += 1.05) {
    stroke(ctx, at(s, 0, 0.3), at(s, 0, height - 0.22), "rgba(10,14,16,.32)", px(ppm, 0.02));
    stroke(
      ctx,
      at(s + 0.025, 0, 0.3),
      at(s + 0.025, 0, height - 0.22),
      "rgba(220,230,232,.07)",
      px(ppm, 0.015),
    );
  }
  // a concrete plinth: the cladding stops clear of the pavement
  const plinth = quad(0, length, 0, 0.3, 0.02);
  if (!(
    basis &&
    fillMaterial(ctx, materials, plinth, { key: "facade-concrete", basis, target: "#6a6a64" })
  ))
    poly(ctx, plinth, "#5f605b");
  stroke(ctx, at(0, 0.02, 0.3), at(length, 0.02, 0.3), "rgba(220,220,210,.22)", px(ppm, 0.025));
  // the fascia: a darker flashing band under the roof edge, with its drip
  poly(ctx, quad(0, length, height - 0.22, height, 0.03), "#2f383c");
  stroke(
    ctx,
    at(0, 0.03, height - 0.22),
    at(length, 0.03, height - 0.22),
    "rgba(0,0,0,.45)",
    px(ppm, 0.03),
  );
  stroke(
    ctx,
    at(0, 0.03, height - 0.02),
    at(length, 0.03, height - 0.02),
    "rgba(205,215,218,.22)",
    px(ppm, 0.02),
  );
}

/** Shared geometry for the albedo and the light behind the glass. */
export const HOME_DEPTH = 0.22;
export function homeInterior(o: Opening, art?: ArchitectureArt) {
  if (o.kind !== "window") return undefined;
  if (o.occupancy === "blind") return art?.homeBlind;
  if (o.occupancy === "nets") return art?.homeNets;
  if (o.occupancy === "curtains" || o.occupancy === "lamp") return art?.homeCurtains;
  return undefined;
}

export type FaceClip = { s0: number; s1: number; zMax: number };
/** All finish stays on its face, including the revealed segment's top and ends. */
export function clipHomeFace(
  ctx: CanvasRenderingContext2D,
  face: ReturnType<typeof facePainter>,
  clip: FaceClip,
) {
  ctx.beginPath();
  face
    .quad(clip.s0, clip.s1, 0, clip.zMax)
    .forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
}

/** A low masonry course joins the home and annex without moving an opening. */
export function paintHomeBase(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  edge: Edge,
  project: Project,
  ppm: number,
  materials?: MaterialSet,
) {
  const face = facePainter(structure, edge, project, ppm);
  const { at, quad, length } = face;
  if (
    !fillMaterial(ctx, materials, quad(0, length, 0, 0.52), {
      key: "home-masonry",
      basis: faceBasis(structure, edge, project, ppm, "home-masonry"),
      target: edge === "north" ? "#514638" : "#403b34",
      strength: 0.92,
    })
  )
    poly(ctx, quad(0, length, 0, 0.52), "#4b4640");
  poly(ctx, quad(0, length, 0.52, 0.59, 0.025), "#8a8070");
  shade(ctx, quad(0, length, 0, 0.18), at(0, 0, 0), at(0, 0, 0.18), [
    [0, "rgba(15,12,9,.5)"],
    [1, "rgba(15,12,9,0)"],
  ]);
}

/** Projecting string courses articulate the storeys at ordinary play scale. */
export function paintHomeWall(
  ctx: CanvasRenderingContext2D,
  face: ReturnType<typeof facePainter>,
  ppm: number,
  height: number,
) {
  const { at, quad, length } = face;
  for (let z = 3.4; z < height - 0.6; z += 3) {
    shade(ctx, quad(0, length, z - 0.24, z), at(0, 0, z), at(0, 0, z - 0.24), [
      [0, "rgba(25,20,15,.32)"],
      [1, "rgba(25,20,15,0)"],
    ]);
    poly(ctx, quad(0, length, z, z + 0.15, 0.08), "#7b7162");
    poly(
      ctx,
      [
        at(0, 0, z + 0.15),
        at(length, 0, z + 0.15),
        at(length, 0.08, z + 0.15),
        at(0, 0.08, z + 0.15),
      ],
      "#a29681",
    );
  }
  poly(ctx, quad(0, length, height - 0.22, height, 0.04), "#8e8475");
  stroke(
    ctx,
    at(0, 0.04, height - 0.22),
    at(length, 0.04, height - 0.22),
    "rgba(0,0,0,.4)",
    px(ppm, 0.035),
  );
}

/** One elevation painter for full buildings and retained cutaway wall segments. */
export function paintHomeFace(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  edge: Edge,
  project: Project,
  ppm: number,
  entrances: SceneEnvironment["entrances"],
  materials?: MaterialSet,
  art?: ArchitectureArt,
  clip?: FaceClip,
) {
  const face = facePainter(structure, edge, project, ppm);
  ctx.save();
  clipHomeFace(ctx, face, clip ?? { s0: 0, s1: face.length, zMax: structure.height });
  // Repaint the base as well: full and revealed faces must have identical grading.
  poly(
    ctx,
    face.quad(0, face.length, 0, structure.height),
    edge === "north" ? "#766957" : "#554f49",
  );
  fillMaterial(ctx, materials, face.quad(0, face.length, 0, structure.height), {
    key: "painted-render",
    basis: faceBasis(structure, edge, project, ppm, "painted-render"),
    target: edge === "north" ? "#766957" : "#554f49",
  });
  paintHomeBase(ctx, structure, edge, project, ppm, materials);
  paintHomeWall(ctx, face, ppm, structure.height);
  for (const o of faceOpenings(structure, edge, entrances)) paintHomeWindow(ctx, face, ppm, o, art);
  // Saved entrances only, carried into the reveal with the rest of the elevation.
  for (const c of facadeOpenings(structure, entrances, edge).doors) {
    const top = Math.min(2.2, structure.height - 0.5);
    poly(ctx, face.quad(c - 0.8, c + 0.8, 0, top), "#202b2e");
    poly(ctx, face.quad(c - 0.88, c + 0.88, top, top + 0.18), "#9a8b74");
    stroke(ctx, face.at(c + 0.55, 0, 0.85), face.at(c + 0.55, 0, 1.05), "#a39a85", px(ppm, 0.045));
  }
  ctx.restore();
}

/** The annex shares the home's plaster/base; its own art still owns the openings. */
export function paintHomeAnnex(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  edge: Edge,
  project: Project,
  ppm: number,
  materials?: MaterialSet,
  clip?: FaceClip,
) {
  const face = facePainter(structure, edge, project, ppm);
  ctx.save();
  clipHomeFace(ctx, face, clip ?? { s0: 0, s1: face.length, zMax: structure.height });
  poly(
    ctx,
    face.quad(0, face.length, 0, structure.height),
    edge === "north" ? "#766957" : "#554f49",
  );
  fillMaterial(ctx, materials, face.quad(0, face.length, 0, structure.height), {
    key: "painted-render",
    basis: faceBasis(structure, edge, project, ppm, "painted-render"),
    target: edge === "north" ? "#766957" : "#554f49",
  });
  paintHomeBase(ctx, structure, edge, project, ppm, materials);
  ctx.restore();
}

/**
 * A shed's loading door: a roller shutter between steel guides, under the box its
 * slats coil into. Drawn in the saved door's place and size; where a service surround
 * is saved over it, the surround is drawn as these guides and this box (see
 * `paintServiceSurround`), so the two never overlap.
 */
export function paintLoadingDoor(
  ctx: CanvasRenderingContext2D,
  face: ReturnType<typeof facePainter>,
  ppm: number,
  centre: number,
  top: number,
  materials?: MaterialSet,
  basis?: ReturnType<typeof wallBasis>,
) {
  const { at, quad } = face;
  const s0 = centre - 0.8,
    s1 = centre + 0.8;
  const door = quad(s0, s1, 0, top, -0.06);
  poly(ctx, quad(s0, s1, 0, top), "#121719");
  if (!(
    basis &&
    fillMaterial(ctx, materials, door, { key: "shutter", basis, target: "#5c6367", strength: 0.9 })
  )) {
    poly(ctx, door, "#41494c");
    for (let z = 0.1; z < top; z += 0.12)
      stroke(ctx, at(s0, -0.06, z), at(s1, -0.06, z), "rgba(0,0,0,.25)", px(ppm, 0.015));
  }
  // the bottom rail, and the slats' shade where they run into the head
  poly(ctx, quad(s0, s1, 0, 0.07, -0.05), "#2a3134");
  shade(ctx, quad(s0, s1, top - 0.3, top, -0.06), at(s0, -0.06, top), at(s0, -0.06, top - 0.3), [
    [0, "rgba(0,0,0,.45)"],
    [1, "rgba(0,0,0,0)"],
  ]);
}

/**
 * The saved service surround over a loading door, drawn as what it is: two steel
 * guide channels with impact paint at their feet, and the shutter's coil box as its
 * head. Same saved span, height and projection as the cream frame it replaces.
 */
export function paintServiceSurround(
  ctx: CanvasRenderingContext2D,
  at: (t: number, out: number, z: number) => Point,
  ppm: number,
  span: number,
  height: number,
  projection: number,
) {
  const box = "#4b555a";
  // the coil box: front, underside and top
  poly(
    ctx,
    [
      at(0, projection, height - 0.36),
      at(span, projection, height - 0.36),
      at(span, projection, height),
      at(0, projection, height),
    ],
    box,
  );
  poly(
    ctx,
    [
      at(0, 0, height - 0.36),
      at(span, 0, height - 0.36),
      at(span, projection, height - 0.36),
      at(0, projection, height - 0.36),
    ],
    "#252c2f",
  );
  poly(
    ctx,
    [
      at(0, 0, height),
      at(span, 0, height),
      at(span, projection, height),
      at(0, projection, height),
    ],
    "#6f797d",
  );
  stroke(
    ctx,
    at(0, projection, height - 0.02),
    at(span, projection, height - 0.02),
    "rgba(220,228,230,.25)",
    px(ppm, 0.02),
  );
  for (const t of [0, span]) {
    // a channel either side, proud of the wall
    stroke(ctx, at(t, 0.05, 0), at(t, 0.05, height - 0.36), "#1b2124", px(ppm, 0.14));
    stroke(ctx, at(t, 0.06, 0), at(t, 0.06, height - 0.36), "#59646a", px(ppm, 0.08));
    // worn impact paint on the foot of each guide, where trolleys and pallets hit
    stroke(ctx, at(t, 0.07, 0.02), at(t, 0.07, 0.9), "rgba(196,160,58,.75)", px(ppm, 0.07));
  }
}

/** The basis a face's materials are laid on, in world metres. */
export function faceBasis(
  structure: SceneStructure,
  edge: Edge,
  project: Project,
  ppm: number,
  key: MaterialKey,
) {
  const r = structure.rect;
  return edge === "north"
    ? wallBasis(project, "x", r.y, SURFACE_MATERIALS[key].metres, ppm)
    : wallBasis(project, "y", r.x + r.width, SURFACE_MATERIALS[key].metres, ppm);
}

/** How many of a home's windows are lit at night: about one in six, at least one, at most three. */
export const LIT_HOMES = { share: 1 / 6, min: 1, max: 3 } as const;

/**
 * The homes lit at night, on faces that look onto open ground (a window against a
 * neighbour's wall gives nothing anyone sees). Only an upper-storey window with
 * somebody behind it (a lamp, curtains or a blind) can be lit; a lamp is lit first,
 * then the rest in an order taken from the window alone, so the same few are lit
 * every night and most of the block stays dark.
 */
export function litHomeWindows(
  structure: SceneStructure,
  entrances: SceneEnvironment["entrances"],
  structures: readonly SceneStructure[],
): { edge: Edge; opening: Opening }[] {
  if (buildingUse(structure) !== "residential") return [];
  const seen: { edge: Edge; opening: Opening }[] = [];
  for (const edge of ["north", "east"] as const) {
    const f = edgeFrame(structure.rect, edge);
    for (const o of faceOpenings(structure, edge, entrances)) {
      if (o.kind !== "window") continue;
      const front = f.world((o.s0 + o.s1) / 2, 1);
      const blocked = structures.some(
        (x) =>
          x !== structure &&
          x.style !== "mesh-fence" &&
          x.style !== "interior-wall" &&
          front.x > x.rect.x &&
          front.x < x.rect.x + x.rect.width &&
          front.y > x.rect.y &&
          front.y < x.rect.y + x.rect.height,
      );
      if (!blocked) seen.push({ edge, opening: o });
    }
  }
  const occupied = seen.filter(({ opening: o }) =>
    ["lamp", "curtains", "blind"].includes(o.occupancy ?? "dark"),
  );
  const rank = (o: Opening) => (o.occupancy === "lamp" ? -1 : (o.seed * 7919) % 1);
  occupied.sort((a, b) => rank(a.opening) - rank(b.opening));
  const count = Math.min(
    LIT_HOMES.max,
    occupied.length,
    Math.max(LIT_HOMES.min, Math.round(seen.length * LIT_HOMES.share)),
  );
  return occupied.slice(0, count);
}
