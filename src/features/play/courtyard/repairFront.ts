/** Repair-shop identity on existing solid wall, shared by full and cutaway faces. */
import type { SceneEnvironment, SceneStructure } from "@/engine";
import { facadeOpenings } from "./architectureArt";
import { faceOpenings, type facePainter } from "./buildingFaces";
import type { Edge } from "./frontage";

type Panel = { s0: number; s1: number; z0: number; z1: number };
export interface RepairFront {
  signs: Panel[];
  aprons: Panel[];
  frames: Panel[];
}

/** Fit to saved openings, including short legacy walls; never invent a doorway. */
export function repairFront(
  s: SceneStructure,
  edge: Edge,
  entrances: SceneEnvironment["entrances"],
): RepairFront {
  const result: RepairFront = { signs: [], aprons: [], frames: [] };
  if (s.style !== "workshop") return result;
  const { length, doors } = facadeOpenings(s, entrances, edge);
  const windows = faceOpenings(s, edge, entrances);
  const occupied: Panel[] = [
    ...windows,
    ...doors.map((c) => ({ s0: c - 1.02, s1: c + 1.02, z0: 0, z1: Math.min(2.65, s.height) })),
  ];
  const fits = (p: Panel) =>
    p.s0 >= 0.1 &&
    p.s1 <= length - 0.1 &&
    p.z0 >= 0.12 &&
    p.z1 <= s.height - 0.12 &&
    p.s1 > p.s0 &&
    p.z1 > p.z0 &&
    !occupied.some(
      (o) =>
        p.s0 < o.s1 + 0.025 && p.s1 > o.s0 - 0.025 && p.z0 < o.z1 + 0.025 && p.z1 > o.z0 - 0.025,
    );
  for (const w of windows.filter((o) => o.kind === "light")) {
    const apron = { s0: w.s0, s1: w.s1, z0: 0.25, z1: w.z0 - 0.15 };
    if (fits(apron)) result.aprons.push(apron);
    for (const frame of [
      { s0: w.s0 - 0.17, s1: w.s0 - 0.035, z0: 0.2, z1: w.z1 + 0.035 },
      { s0: w.s1 + 0.035, s1: w.s1 + 0.17, z0: 0.2, z1: w.z1 + 0.035 },
      { s0: w.s0 - 0.17, s1: w.s1 + 0.17, z0: w.z1 + 0.04, z1: w.z1 + 0.17 },
    ])
      if (fits(frame)) result.frames.push(frame);
  }
  for (const c of doors) {
    for (const [s0, s1] of [
      [c - 1.22, c - 1.07],
      [c + 1.07, c + 1.22],
    ]) {
      const p = { s0: s0!, s1: s1!, z0: 0.2, z1: Math.min(2.6, s.height - 0.16) };
      if (fits(p)) result.frames.push(p);
    }
  }
  // The low repair sheds have no spare header above the glazing. Put the broad
  // enamel trade sign on the solid apron instead, across the first paired bays.
  for (let i = 0; i + 1 < result.aprons.length; i++) {
    const a = result.aprons[i]!,
      b = result.aprons[i + 1]!;
    const panel = { s0: a.s0 + 0.08, s1: b.s1 - 0.08, z0: 0.36, z1: Math.min(a.z1, b.z1) - 0.07 };
    if (panel.s1 - panel.s0 <= 5.4 && fits(panel)) {
      result.signs.push(panel);
      break;
    }
  }
  return result;
}

/** Broad constructed forms first; small fasteners only support the material. No emission. */
export function paintRepairFront(
  ctx: CanvasRenderingContext2D,
  face: ReturnType<typeof facePainter>,
  detail: RepairFront,
  ppm: number,
) {
  const { at, quad } = face;
  const fill = (p: Panel, color: string, out = 0.06) => {
    ctx.beginPath();
    quad(p.s0, p.s1, p.z0, p.z1, out).forEach((v, i) =>
      i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y),
    );
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const line = (s0: number, z0: number, s1: number, z1: number, color: string, width: number) => {
    const a = at(s0, 0.085, z0),
      b = at(s1, 0.085, z1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * ppm;
    ctx.stroke();
  };
  const label = (p: Panel, text: string, color: string) => {
    const o = at(p.s0, 0.08, p.z1),
      u = at(p.s0 + 1, 0.08, p.z1);
    ctx.save();
    ctx.transform(u.x - o.x, u.y - o.y, 0, ppm, o.x, o.y);
    ctx.font = `700 ${Math.min(0.34, (p.z1 - p.z0) * 0.64)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, (p.s1 - p.s0) / 2, (p.z1 - p.z0) / 2, p.s1 - p.s0 - 0.2);
    ctx.restore();
  };
  ctx.save();
  for (const [index, p] of detail.aprons.entries()) {
    fill(p, "#303b3c");
    fill({ s0: p.s0 + 0.07, s1: p.s1 - 0.07, z0: p.z0 + 0.07, z1: p.z1 - 0.06 }, "#685e48");
    for (let x = p.s0 + 0.12; x < p.s1 - 0.09; x += 0.13) {
      line(x, p.z0 + 0.08, x, p.z1 - 0.07, "#393c34", 0.035);
      line(x + 0.03, p.z0 + 0.08, x + 0.03, p.z1 - 0.07, "#8a8065", 0.018);
    }
    const badge = { s0: p.s0 + 0.15, s1: p.s1 - 0.15, z0: p.z0 + 0.18, z1: p.z1 - 0.16 };
    if (badge.z1 - badge.z0 > 0.2) {
      fill(badge, "#25383c", 0.085);
      label(badge, ["PARTS", "SERVICE", "AUDIO", "TOOLS"][index % 4]!, "#c4b794");
    }
    line(p.s0, p.z1, p.s1, p.z1, "#a19473", 0.055);
  }
  for (const p of detail.frames) {
    fill(p, "#213237");
    line(p.s0 + 0.025, p.z0, p.s0 + 0.025, p.z1, "#9a8762", 0.035);
    if (p.s1 - p.s0 > 0.3) line(p.s0, p.z1, p.s1, p.z1, "#a29372", 0.035);
  }
  for (const p of detail.signs) {
    fill(p, "#172a30");
    fill({ s0: p.s0 + 0.06, s1: p.s1 - 0.06, z0: p.z0 + 0.055, z1: p.z1 - 0.055 }, "#756747");
    label(p, "DENKI  /  ELECTRIC REPAIR", "#e1d2a4");
    line(p.s0, p.z0, p.s1, p.z0, "#0d2028", 0.055);
    line(p.s0, p.z1, p.s1, p.z1, "#a89971", 0.03);
  }
  ctx.restore();
}
