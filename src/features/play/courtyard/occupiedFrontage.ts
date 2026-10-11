/** Occupied repair premises: saved shop/portal attachments select presentation only.
 * The workshop is a shallow display recess, never an extra traversable interior. */
import type { Point, SceneEnvironment, SceneStructure } from "@/engine";
import type { ArchitectureArt } from "./architecturePack";
import { architecturalDepth } from "./architecturalDepth";
import { paintFaceAsset } from "./afterRainArt";
import { paintArchitecturalBay } from "./paintedArchitecture";
import { facePainter } from "./buildingFaces";
import { facadeOpenings } from "./architectureArt";
import { edgeFrame, type Edge } from "./frontage";
import { paintWorkshopInterior } from "./workshopInterior";
import type { GroundLight } from "./nightLighting";

export function occupiedUse(s: SceneStructure): "repair" | "studios" | undefined {
  if (s.style !== "shop" || s.height < 6.8) return;
  if (s.attachments?.some((a) => a.id === "retail-header")) return "repair";
  if (s.attachments?.some((a) => a.id === "repair-studios-portal")) return "studios";
  return undefined;
}

/** Display recesses fit the solid spans beside saved entrances. No new doorway. */
export function repairBays(
  s: SceneStructure,
  edge: Edge,
  entrances: SceneEnvironment["entrances"],
) {
  const { length, doors } = facadeOpenings(s, entrances, edge);
  if (length < 1.3) return [];
  let spans: [number, number][] = [[0.3, length - 0.3]];
  for (const c of doors)
    spans = spans.flatMap(([a, b]) =>
      c + 1.04 <= a || c - 1.04 >= b
        ? [[a, b]]
        : ([
            [a, Math.min(b, c - 1.04)],
            [Math.max(a, c + 1.04), b],
          ].filter(([x, y]) => y! - x! > 0.7) as [number, number][]),
    );
  if (!doors.length && length > 4.8)
    spans = [
      [0.3, length * 0.56],
      [length * 0.56 + 0.38, length - 0.3],
    ];
  return spans.map(([a, b], i) => ({
    a,
    b,
    lo: i === 0 ? 0.78 : 0.38,
    hi: i === 0 ? 2.62 : 2.38,
    depth: i === 0 ? 0.52 : 0.34,
    kind: i === 0 ? ("bench" as const) : ("parts" as const),
  }));
}

export function occupiedLights(env: SceneEnvironment): GroundLight[] {
  return env.structures.flatMap((s) => {
    const use = occupiedUse(s);
    if (!use) return [];
    return (["north", "east"] as const).flatMap((edge) => {
      const f = edgeFrame(s.rect, edge);
      const doors = facadeOpenings(s, env.entrances, edge).doors;
      const spans =
        use === "repair"
          ? [
              ...repairBays(s, edge, env.entrances).map((b) => [b.a, b.b] as const),
              ...doors.map((c) => [c - 0.72, c + 0.72] as const),
            ]
          : doors.map((c) => [c - 0.7, c + 0.7] as const);
      const spills: GroundLight[] = spans.map(([a, b]) => ({
        kind: "spill" as const,
        origin: f.world(0, 0),
        along: edge === "north" ? { x: 1, y: 0 } : { x: 0, y: 1 },
        out: edge === "north" ? { x: 0, y: -1 } : { x: 1, y: 0 },
        s0: a,
        s1: b,
        reach: use === "repair" ? 4.6 : 3.4,
        spread: 0.45,
        color: use === "repair" ? ([1, 0.64, 0.3] as const) : ([0.46, 0.79, 1] as const),
        intensity: use === "repair" ? 0.68 : 0.5,
      }));
      // The cyan header and warm workbench are separate, visible emitters.
      if (use === "repair")
        spills.push({
          kind: "pool",
          centre: f.world(f.length / 2, 0.18),
          sourceZ: 3.25,
          color: [0.12, 0.85, 1],
          intensity: 0.26,
          radius: 3.4,
        });
      return spills;
    });
  });
}

export function paintOccupiedFrontage(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  edge: Edge,
  entrances: SceneEnvironment["entrances"],
  project: (p: Point) => Point,
  ppm: number,
  pass: "albedo" | "light" | "glow",
  art?: ArchitectureArt,
  emissionOnly = false,
) {
  const use = occupiedUse(s);
  if (!use) return;
  const face = facePainter(s, edge, project, ppm);
  const { at, quad, length } = face;
  const fill = (points: Point[], color: string | CanvasGradient) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const panel = (a: number, b: number, lo: number, hi: number, color: string, out = 0.06) =>
    fill(quad(a, b, lo, hi, out), color);
  const line = (a: Point, b: Point, color: string, w = 0.035) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = w * ppm;
    ctx.stroke();
  };
  const text = (label: string, a: number, b: number, lo: number, hi: number, color: string) => {
    const p = at(a, 0.11, hi),
      q = at(a + 1, 0.11, hi);
    ctx.save();
    ctx.transform(q.x - p.x, q.y - p.y, 0, ppm, p.x, p.y);
    ctx.font = `600 ${(hi - lo) * 0.65}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(label, (b - a) / 2, (hi - lo) / 2, b - a - 0.12);
    ctx.restore();
  };
  const wash = (a: number, b: number, lo: number, hi: number, color: string) => {
    const p = at(a, 0, hi),
      q = at(a, 0, lo);
    const g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    fill(quad(a, b, lo, hi), g);
  };
  const doors = facadeOpenings(s, entrances, edge).doors;
  if (use === "studios") {
    for (const c of doors) {
      if (pass === "albedo") {
        panel(c - 1, c + 1, 0, 2.7, "#1b292e");
        paintFaceAsset(ctx, art?.residentialDoor, at, c - 0.92, c + 0.92, 0, 2.5);
        panel(c - 1.05, c + 1.05, 2.62, 2.85, "#465659", 0.15);
        panel(c - 0.65, c + 0.65, 2.66, 2.73, "#b5c4b7", 0.17);
        panel(c - 0.9, c + 0.9, 2.98, 3.47, "#263c42");
        text("STUDIOS  /  02", c - 0.85, c + 0.85, 3.04, 3.38, "#c4c7ae");
        for (const z of [3.65, 3.72]) line(at(0, 0.09, z), at(length, 0.09, z), "#172c31", 0.045);
        for (let x = 0.4; x < length; x += 1.1) line(at(x, 0.12, 3.6), at(x, 0.12, 3.8), "#6f7c72");
      } else if (pass === "light") wash(c - 1.15, c + 1.15, 0.1, 2.9, "rgba(105,184,227,.65)");
      else {
        panel(c - 0.65, c + 0.65, 2.66, 2.73, "#c7eaff", 0.17);
        paintFaceAsset(ctx, art?.residentialDoorEmission, at, c - 0.92, c + 0.92, 0, 2.5);
      }
    }
    return;
  }
  const bays = repairBays(s, edge, entrances);
  if (pass === "light") {
    if (!emissionOnly) wash(0.15, length - 0.15, 0.1, 3.65, "rgba(80,194,226,.24)");
    for (const b of bays) {
      ctx.save();
      ctx.beginPath();
      quad(b.a, b.b, b.lo, b.hi).forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      ctx.closePath();
      ctx.clip();
      panel(b.a, b.b, b.lo, b.hi, "rgba(255,198,125,.48)", -b.depth);
      ctx.restore();
    }
    for (const c of doors) panel(c - 0.72, c + 0.72, 0.08, 2.3, "rgba(255,198,125,.4)", -0.08);
    return;
  }
  if (pass === "glow") {
    for (const c of doors) panel(c - 0.66, c + 0.66, 2.22, 2.27, "#ffdfa0", -0.18);
    text("DENKI  /  ELECTRIC", 0.25, length - 0.25, 3.07, 3.51, "#52e7ff");
    panel(0.35, length - 0.35, 2.81, 2.86, "#f6ca85", 0.15);
    for (const b of bays) panel(b.a + 0.15, b.b - 0.15, b.hi - 0.19, b.hi - 0.15, "#ffe2a5", -0.12);
    return;
  }
  // A continuous dark enamel trading floor under the existing apartment string course.
  panel(0, length, 0.08, 3.8, edge === "north" ? "#465453" : "#303f41", 0.015);
  for (let x = 0.15; x < length; x += 0.55) {
    line(at(x, 0.035, 0.2), at(x, 0.035, 2.75), "rgba(18,28,29,.3)", 0.018);
  }
  panel(0, length, 0.08, 0.27, "#242f30");
  panel(0.1, length - 0.1, 2.96, 3.65, "#152d32", 0.08);
  panel(0.16, length - 0.16, 3.59, 3.65, "#82918a", 0.11);
  text("DENKI  /  ELECTRIC", 0.25, length - 0.25, 3.07, 3.51, "#d7c194");
  panel(0.25, length - 0.25, 2.7, 2.93, "#27393b", 0.14);
  text("REPAIR   •   AUDIO   •   PARTS", 0.3, length - 0.3, 2.72, 2.9, "#aaad91");
  // A deep cornice caps the trading floor: a broad dark soffit beneath the
  // brighter ledge, not another thin outline around every panel.
  fill(
    [
      at(0.04, 0, 3.72),
      at(length - 0.04, 0, 3.72),
      at(length - 0.04, 0.26, 3.72),
      at(0.04, 0.26, 3.72),
    ],
    "#172c2d",
  );
  panel(0.04, length - 0.04, 3.72, 3.84, "#63736b", 0.26);
  panel(0.04, length - 0.04, 3.58, 3.72, "rgba(9,23,24,.42)", 0.09);
  // Deep workshop display bays: pegboard, bench, repaired electronics and task lights.
  for (const b of bays) {
    paintArchitecturalBay(
      ctx,
      art?.paintedRepairFrontage,
      at,
      { s0: Math.max(0, b.a - 0.2), s1: Math.min(length, b.b + 0.2), z0: 0.08, z1: 2.7 },
      { s0: b.a, s1: b.b, z0: b.lo, z1: b.hi },
      "frontage",
      true,
    );
    panel(b.a - 0.08, b.b + 0.08, b.lo - 0.08, b.hi + 0.08, "#142327");
    const interior =
      b.b - b.a < 2
        ? art?.repairPartsNarrow
        : b.kind === "bench"
          ? art?.repairBench
          : art?.repairParts;
    ctx.save();
    ctx.beginPath();
    quad(b.a, b.b, b.lo, b.hi).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
    if (interior) paintFaceAsset(ctx, interior, at, b.a, b.b, b.lo, b.hi, -b.depth);
    else paintWorkshopInterior(ctx, face, b.a, b.b, b.kind === "bench" ? "bench" : "storage");
    ctx.restore();
    // Angled reveals and mullions anchor the interior behind the actual facade.
    fill(
      [at(b.a, 0.04, b.lo), at(b.a, 0.04, b.hi), at(b.a, -b.depth, b.hi), at(b.a, -b.depth, b.lo)],
      "#262b28",
    );
    fill(
      [at(b.a, 0.04, b.hi), at(b.b, 0.04, b.hi), at(b.b, -b.depth, b.hi), at(b.a, -b.depth, b.hi)],
      "#192623",
    );
    // A substantial head reveal separates the warm room from the exterior fascia.
    panel(b.a, b.b, b.hi - 0.16, b.hi, "rgba(8,19,19,.68)", -0.08);
    fill(
      [at(b.a, 0.04, b.lo), at(b.b, 0.04, b.lo), at(b.b, -b.depth, b.lo), at(b.a, -b.depth, b.lo)],
      "#6d725f",
    );
    for (const x of [b.a, b.b - 0.035]) panel(x, x + 0.035, b.lo, b.hi, "#89928a", 0.04);
    panel(b.a - 0.08, b.b + 0.08, b.lo - 0.09, b.lo, "#9c997f", 0.12);
    panel(b.a + 0.15, b.b - 0.15, b.hi - 0.19, b.hi - 0.15, "#d2c197", -0.12);
    if (b.kind === "bench") {
      fill(
        [
          at(b.a - 0.06, -0.3, b.lo),
          at(b.b + 0.06, -0.3, b.lo),
          at(b.b + 0.06, 0.2, b.lo),
          at(b.a - 0.06, 0.2, b.lo),
        ],
        "#a18a62",
      );
      panel(b.a - 0.06, b.b + 0.06, b.lo - 0.1, b.lo, "#544637", 0.2);
    }
    architecturalDepth(ctx, at, false).bay({ s0: b.a, s1: b.b, z0: b.lo, z1: b.hi }, 0.22);
  }
  for (const c of doors) {
    const a = c - 0.78,
      b = c + 0.78,
      top = 2.35,
      back = art?.repairOpenRoom ? -0.24 : -0.6;
    panel(a - 0.1, b + 0.1, 0.02, 2.65, "#172522");
    ctx.save();
    ctx.beginPath();
    quad(a, b, 0.04, top).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
    if (art?.repairOpenRoom) paintFaceAsset(ctx, art.repairOpenRoom, at, a, b, 0.04, top, -0.06);
    else {
      panel(a, b, 0.04, top, "#594c35", back);
      paintFaceAsset(ctx, art?.repairPartsNarrow, at, a + 0.25, b + 0.1, 0.2, 2.3, back);
      panel(a, a + 0.25, 0.1, 2.24, "#202d29", back);
    }
    fill([at(a, 0, 0.06), at(b, 0, 0.06), at(b, back, 0.06), at(a, back, 0.06)], "#b19a70");
    for (const z of [-0.25, -0.5]) line(at(a, z, 0.065), at(b, z, 0.065), "#6e644d", 0.018);
    fill([at(a, 0, 0.04), at(a, 0, top), at(a, back, top), at(a, back, 0.04)], "#736c50");
    fill([at(b, 0, 0.04), at(b, 0, top), at(b, back, top), at(b, back, 0.04)], "#303e34");
    fill([at(a, 0, top), at(b, 0, top), at(b, back, top), at(a, back, top)], "#1a2927");
    ctx.restore();
    // Raised curtain stays above the walk-through opening, with substantial jambs.
    for (let z = 2.36; z < 2.61; z += 0.075) panel(a, b, z, z + 0.058, "#798076", 0.06);
    for (const x of [a - 0.07, b]) panel(x, x + 0.07, 0.02, 2.65, "#a39a79", 0.09);
    panel(a, b, 2.3, 2.36, "#c0ab79", 0.06);
    panel(a, b, 0.02, 0.07, "#cab080", 0.15);
    panel(a + 0.12, b - 0.12, 2.22, 2.27, "#cdb68a", -0.18);
  }

  for (const x of [0.12, length - 0.18]) {
    panel(x, x + 0.065, 0.2, 2.68, "#161f22", 0.1);
    line(at(x, 0.13, 0.2), at(x, 0.13, 2.68), "#8b9687", 0.025);
  }
}

/** Shared silhouette for albedo and occlusion of additive window lighting. */
export function paintOccupiedCanopy(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  edge: Edge,
  project: (p: Point) => Point,
  ppm: number,
  art?: ArchitectureArt,
) {
  if (occupiedUse(s) !== "repair") return;
  const { at, quad, length } = facePainter(s, edge, project, ppm);
  const fill = (ps: Point[], color: string) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const panel = (a: number, b: number, lo: number, hi: number, color: string, out: number) =>
    fill(quad(a, b, lo, hi, out), color);
  const line = (a: Point, b: Point, color: string, w: number) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = w * ppm;
    ctx.stroke();
  };
  const depth = architecturalDepth(ctx, at, false);
  depth.shade(0.08, length - 0.08, 2.97, 0.72, 0.65);
  fill(
    [
      at(0.08, 0, 2.91),
      at(length - 0.08, 0, 2.91),
      at(length - 0.08, 0.72, 2.77),
      at(0.08, 0.72, 2.77),
    ],
    "#172a2c",
  );
  // Folded metal canopy: a real top plane and fascia break the flat wall silhouette.
  // It remains above every entrance and below the existing sign.
  fill(
    [
      at(0.08, 0, 3.03),
      at(length - 0.08, 0, 3.03),
      at(length - 0.08, 0.72, 2.89),
      at(0.08, 0.72, 2.89),
    ],
    "#607777",
  );
  paintMetalPlane(
    ctx,
    art?.balconyMetal,
    at(0.08, 0, 3.03),
    at(length - 0.08, 0, 3.03),
    at(0.08, 0.72, 2.89),
    length - 0.16,
    0.72,
  );
  panel(0.08, length - 0.08, 2.77, 2.89, "#263f43", 0.72);
  for (let x = 0.18; x < length - 0.1; x += 0.48)
    line(at(x, 0.02, 3.04), at(x, 0.71, 2.9), "#89958a", 0.018);
  for (const x of [0.3, length - 0.3]) line(at(x, 0.02, 2.45), at(x, 0.7, 2.79), "#23373a", 0.05);
}

/** A shallow first-floor balcony, attached above head height, within the facade span. */
export function paintOccupiedBalcony(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  edge: Edge,
  project: (p: Point) => Point,
  ppm: number,
  art?: ArchitectureArt,
) {
  if (occupiedUse(s) !== "repair" || edge !== "east") return;
  const face = facePainter(s, edge, project, ppm);
  // Lift the landing clear of the sign in this oblique camera projection.
  const at = (x: number, out: number, z: number) => face.at(x, out, z + 0.35);
  const quad = (a: number, b: number, lo: number, hi: number, out: number) =>
    face.quad(a, b, lo + 0.35, hi + 0.35, out);
  const fill = (ps: Point[], c: string) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
  };
  const line = (a: Point, b: Point, c: string, w: number) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = c;
    ctx.lineWidth = w * ppm;
    ctx.stroke();
  };
  const depth = architecturalDepth(ctx, at, false);
  depth.shade(1, 5, 4.05, 0.7, 0.62);
  depth.shade(0.86, 5.14, 6.32, 0.65, 0.6);
  fill([at(1, 0, 4.05), at(5, 0, 4.05), at(5, 0.85, 4.05), at(1, 0.85, 4.05)], "#182b2c");
  fill([at(1, 0, 4.25), at(5, 0, 4.25), at(5, 0.85, 4.25), at(1, 0.85, 4.25)], "#777c6c");
  paintMetalPlane(
    ctx,
    art?.balconyMetal,
    at(1, 0, 4.25),
    at(5, 0, 4.25),
    at(1, 0.85, 4.25),
    4,
    0.72,
  );
  fill(quad(1, 5, 4.05, 4.25, 0.85), "#354644");
  for (const x of [1.1, 4.9]) line(at(x, 0, 3.92), at(x, 0.8, 4.15), "#273734", 0.07);
  for (let x = 1; x <= 5; x += 0.4) line(at(x, 0.85, 4.23), at(x, 0.85, 5.2), "#75857b", 0.035);
  for (const z of [4.4, 5.2]) line(at(1, 0.85, z), at(5, 0.85, z), "#a0a58f", 0.045);
  for (const x of [1, 5]) line(at(x, 0, 5.2), at(x, 0.85, 5.2), "#929c8b", 0.045);
  // Privacy screens, drain and canopy make a recognisable occupied outdoor room.
  fill(quad(1.02, 2.05, 4.35, 4.91, 0.855), "#586b61");
  for (let x = 1.08; x < 2.05; x += 0.13)
    line(at(x, 0.865, 4.39), at(x, 0.865, 4.89), "#91a08b", 0.025);
  for (const x of [1, 5]) line(at(x, 0.85, 4.25), at(x, 0.85, 6.43), "#516960", 0.065);
  fill(
    [at(0.86, 0, 6.62), at(5.14, 0, 6.62), at(5.14, 0.98, 6.43), at(0.86, 0.98, 6.43)],
    "#6a7e72",
  );
  paintMetalPlane(
    ctx,
    art?.balconyMetal,
    at(0.86, 0, 6.62),
    at(5.14, 0, 6.62),
    at(0.86, 0.98, 6.43),
    4.28,
    0.98,
  );
  fill(quad(0.86, 5.14, 6.32, 6.43, 0.98), "#2d4747");
  for (let x = 1; x < 5.1; x += 0.42) line(at(x, 0, 6.63), at(x, 0.98, 6.44), "#95a08b", 0.018);
  // A folded cloth and two modest plant pots supply habitation without a repeated prop row.
  fill(quad(3.8, 4.45, 4.45, 5.24, 0.865), "#756959");
  for (const x of [1.35, 1.9]) {
    fill(quad(x, x + 0.25, 4.25, 4.47, 0.3), "#80654b");
    for (const k of [-0.08, 0.02, 0.13])
      line(at(x + 0.12, 0.3, 4.44), at(x + 0.12 + k, 0.3, 4.72 + Math.abs(k)), "#647758", 0.055);
  }
}

/** The 256px tile spans two metres on each constructed plane, not the screen. */
function paintMetalPlane(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource | undefined,
  o: Point,
  u: Point,
  v: Point,
  width: number,
  depth: number,
) {
  if (!image) return;
  const pattern = ctx.createPattern(image, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.transform(
    (u.x - o.x) / (width * 128),
    (u.y - o.y) / (width * 128),
    (v.x - o.x) / (depth * 128),
    (v.y - o.y) / (depth * 128),
    o.x,
    o.y,
  );
  ctx.globalAlpha *= 0.65;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width * 128, depth * 128);
  ctx.restore();
}
