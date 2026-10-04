/**
 * Drawing the Rap Sheet.
 *
 * Hand-drawn on a canvas, with no image-rendering dependency. The card is a
 * fixed layout of a dozen things, drawn the way `rain.ts` draws a storm, and a
 * DOM-to-image library would have been a hundred kilobytes to photograph a page
 * we already know the shape of — and a fight with web fonts, which a canvas does
 * not have, because it measures the font it actually got.
 *
 * Two rules keep it honest:
 *
 *  - EVERY LINE OF TEXT IS FITTED. A handle is whatever the player typed; a font
 *    may not have loaded; a Role's ability may be long. Each string is measured
 *    with the font actually in use and shrunk, then ellipsised, to its box, so
 *    nothing runs off the card whatever it is made of.
 *
 *  - IT TOUCHES NOTHING BUT THE CONTEXT. No DOM, no fetch, no storage: pictures
 *    arrive already loaded (`RapAssets`) and the result is whatever the context
 *    now holds. That is what lets a test drive it with a recording context.
 *
 * Presentation only. The words are `rapSheetModel.ts`'s.
 */
import { PHOTO_ANCHOR_Y } from "@/features/chargen/polaroidCrop";
import { SITE_URL } from "@/lib/siteMeta";
import {
  RAP_FORMATS,
  type RapFormat,
  type RapAssociate,
  type RapSheet,
  type RapTone,
} from "./rapSheetModel";

type Ctx = CanvasRenderingContext2D;

/** Pictures, already loaded. A missing one is drawn as a placeholder, never as a gap. */
export type RapAssets = {
  portrait: CanvasImageSource | null;
  /** Cast faces by the URL the model gave them. */
  faces: Record<string, CanvasImageSource>;
};

export const DISPLAY = '"Archivo", "Helvetica Neue", Arial, sans-serif';
export const MONO = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
export const PIXEL = '"Silkscreen", "IBM Plex Mono", ui-monospace, Menlo, monospace';

const BG = "#07050f";
const INK = "#f2f0ff";
const DIM = "#8f8cc4";
const FAINT = "#352d6b";
const CYAN = "#34d5e6";
const RED = "#ff4d4d";
const PINK = "#ff3d9a";
const PAPER = "#ece8f7";
const PAPER_INK = "#241f3d";

const TONE_COLOR: Record<RapTone, string> = {
  good: CYAN,
  bad: RED,
  neutral: DIM,
  dead: "#6b6b7d",
};

// ---------------------------------------------------------------------------
// Small tools
// ---------------------------------------------------------------------------

function setSpacing(ctx: Ctx, px: number): void {
  // Letter spacing is a progressive enhancement: where it is not supported the
  // text is simply set tight, and `measureText` still tells the truth about it.
  if ("letterSpacing" in ctx)
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

type Face = { weight?: number | string; family: string };
const font = (size: number, face: Face) =>
  `${face.weight ?? 400} ${Math.round(size)}px ${face.family}`;

type PutOptions = {
  size: number;
  face: Face;
  fill: string;
  align?: CanvasTextAlign;
  spacing?: number;
  glow?: string;
  alpha?: number;
};

/** One line of text, as set. */
function put(ctx: Ctx, text: string, x: number, y: number, o: PutOptions): void {
  ctx.save();
  ctx.font = font(o.size, o.face);
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = o.alpha ?? 1;
  setSpacing(ctx, o.spacing ?? 0);
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = Math.max(8, o.size * 0.35);
  }
  ctx.fillStyle = o.fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function widthOf(ctx: Ctx, text: string, size: number, face: Face, spacing = 0): number {
  ctx.save();
  ctx.font = font(size, face);
  setSpacing(ctx, spacing);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

/**
 * The biggest size, from `max` down to `min`, at which the text fits `maxWidth`;
 * and when even `min` is too wide, the text cut with an ellipsis until it does.
 */
function fitted(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  face: Face,
  max: number,
  min: number,
  spacing = 0,
): { text: string; size: number } {
  for (let size = max; size >= min; size -= 2) {
    if (widthOf(ctx, text, size, face, spacing) <= maxWidth) return { text, size };
  }
  // By character, not UTF-16 unit: a cut through an emoji leaves half of it.
  const chars = Array.from(text);
  while (chars.length > 1 && widthOf(ctx, `${chars.join("")}…`, min, face, spacing) > maxWidth) {
    chars.pop();
  }
  return { text: `${chars.join("").trimEnd()}…`, size: min };
}

/** Text fitted to a box, then set. Returns the size it settled on. */
function putFit(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  o: Omit<PutOptions, "size"> & { max: number; min: number },
): number {
  const f = fitted(ctx, text, maxWidth, o.face, o.max, o.min, o.spacing ?? 0);
  put(ctx, f.text, x, y, { ...o, size: f.size });
  return f.size;
}

/** Words wrapped to a width, at most `maxLines` of them, the last ellipsised. */
function wrap(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  face: Face,
  size: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let start = 0;
  for (let i = 0; i < words.length; i += 1) {
    const next = line ? `${line} ${words[i]}` : words[i]!;
    if (widthOf(ctx, next, size, face) <= maxWidth || !line) {
      line = next;
      continue;
    }
    // This is the last line there is room for: keep everything that is left on
    // it, and let `fitted` ellipsise it, rather than dropping words unmarked.
    if (lines.length === maxLines - 1) {
      line = words.slice(start).join(" ");
      break;
    }
    lines.push(line);
    line = words[i]!;
    start = i;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines).map((l, i, all) => {
    if (i < all.length - 1 && widthOf(ctx, l, size, face) <= maxWidth) return l;
    return fitted(ctx, l, maxWidth, face, size, size).text;
  });
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function sizeOf(image: CanvasImageSource): { w: number; h: number } {
  const i = image as {
    width?: number;
    height?: number;
    naturalWidth?: number;
    naturalHeight?: number;
  };
  return { w: i.naturalWidth ?? i.width ?? 1, h: i.naturalHeight ?? i.height ?? 1 };
}

/** A picture covering a box, anchored toward the top, because heads are up there. */
function drawCover(
  ctx: Ctx,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  anchorY: number,
): void {
  const src = sizeOf(image);
  const scale = Math.max(w / src.w, h / src.h);
  const dw = src.w * scale;
  const dh = src.h * scale;
  ctx.drawImage(image, x - (dw - w) / 2, y - (dh - h) * anchorY, dw, dh);
}

/** Drains a region of its colour, for a picture of somebody who is gone. */
function drain(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "saturation";
  ctx.fillStyle = "#808080";
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(150,150,160,1)";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A barcode that is a fingerprint of the file number. Decoration; it scans as nothing. */
function barcode(
  ctx: Ctx,
  seed: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.save();
  ctx.fillStyle = color;
  let at = x;
  let n = hash(seed);
  while (at < x + w) {
    n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d) >>> 0;
    const bar = 2 + (n % 5);
    const gap = 2 + ((n >>> 8) % 4);
    if (at + bar > x + w) break;
    ctx.fillRect(at, y, bar, h);
    at += bar + gap;
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

const MARGIN = 64;

function statusColor(sheet: RapSheet): string {
  return sheet.status === "flatlined" ? RED : sheet.status === "active" ? CYAN : sheet.theme.accent;
}

function background(ctx: Ctx, sheet: RapSheet, W: number, H: number): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const glowA = ctx.createRadialGradient(W * 0.88, H * 0.1, 0, W * 0.88, H * 0.1, W * 0.95);
  glowA.addColorStop(0, sheet.theme.glow);
  glowA.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, W, H);

  const glowB = ctx.createRadialGradient(W * 0.05, H * 0.98, 0, W * 0.05, H * 0.98, W * 0.8);
  glowB.addColorStop(0, "rgba(255,61,154,0.20)");
  glowB.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 60) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 0; y <= H; y += 60) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function header(ctx: Ctx, sheet: RapSheet, W: number, y: number): void {
  put(ctx, "NIGHT CITY TALES", MARGIN, y, {
    size: 22,
    face: { family: MONO, weight: 600 },
    fill: DIM,
    spacing: 6,
  });
  put(ctx, `FILE NO. ${sheet.fileNo}`, W - MARGIN, y, {
    size: 22,
    face: { family: MONO, weight: 600 },
    fill: DIM,
    spacing: 3,
    align: "right",
  });
  ctx.save();
  ctx.fillStyle = sheet.theme.accent;
  ctx.shadowColor = sheet.theme.glow;
  ctx.shadowBlur = 14;
  ctx.fillRect(MARGIN, y + 18, W - 2 * MARGIN, 3);
  ctx.fillRect(MARGIN, y + 18, 120, 8);
  ctx.restore();
}

function title(ctx: Ctx, sheet: RapSheet, W: number, y: number, maxSize: number): void {
  const face = { family: DISPLAY, weight: 800 };
  // The right-hand lines get the room they need, and the title takes what is
  // left: measured, so a wider fallback font shrinks it rather than overlaps it.
  const sideWidth = 290;
  const room = W - 2 * MARGIN - sideWidth - 36;
  let size = maxSize;
  while (size > 64 && widthOf(ctx, "RAP SHEET", size, face) > room) size -= 4;

  // Chromatic split behind the real thing: the look of a print that did not
  // quite register.
  put(ctx, "RAP SHEET", MARGIN - 5, y, { size, face, fill: CYAN, alpha: 0.55 });
  put(ctx, "RAP SHEET", MARGIN + 5, y, { size, face, fill: PINK, alpha: 0.55 });
  put(ctx, "RAP SHEET", MARGIN, y, { size, face, fill: INK, glow: sheet.theme.glow });

  const lines = ["CONFIDENTIAL", "FOR FIXER EYES ONLY"];
  const record = sheet.record.length
    ? sheet.record.map((r) => `${r.value} ${r.label}`).join(" · ")
    : null;
  if (record) lines.unshift(record);
  lines.forEach((line, i) => {
    putFit(ctx, line, W - MARGIN, y - (lines.length - 1 - i) * 30, sideWidth, {
      face: { family: MONO, weight: 600 },
      fill: record && i === 0 ? INK : DIM,
      spacing: 3,
      align: "right",
      max: record && i === 0 ? 24 : 20,
      min: 12,
    });
  });
}

function stamp(ctx: Ctx, sheet: RapSheet, cx: number, cy: number, size: number): void {
  const color = statusColor(sheet);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.2);
  const face = { family: PIXEL };
  const w = widthOf(ctx, sheet.stamp, size, face, 4) + 44;
  const h = size + 36;
  ctx.fillStyle = "rgba(7,5,15,0.62)";
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.2);
  put(ctx, sheet.stamp, 0, size * 0.36, {
    size,
    face,
    fill: color,
    align: "center",
    spacing: 4,
    glow: color,
  });
  ctx.restore();
}

function polaroid(
  ctx: Ctx,
  sheet: RapSheet,
  assets: RapAssets,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.035);
  ctx.translate(-w / 2, -h / 2);

  // The print.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = PAPER;
  roundRect(ctx, 0, 0, w, h, 8);
  ctx.fill();
  ctx.restore();

  // The window.
  const pad = 22;
  const px = pad;
  const py = pad;
  const pw = w - 2 * pad;
  const ph = h - pad - 92;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 3);
  ctx.clip();
  if (assets.portrait) {
    ctx.fillStyle = "#000";
    ctx.fillRect(px, py, pw, ph);
    drawCover(ctx, assets.portrait, px, py, pw, ph, PHOTO_ANCHOR_Y / 100);
  } else {
    // No picture yet: a dark window and the initial, the way a roster shows one.
    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, "#1a1433");
    g.addColorStop(1, "#0c0818");
    ctx.fillStyle = g;
    ctx.fillRect(px, py, pw, ph);
    put(ctx, (Array.from(sheet.handle)[0] ?? "?").toUpperCase(), px + pw / 2, py + ph * 0.62, {
      size: ph * 0.5,
      face: { family: DISPLAY, weight: 800 },
      fill: "rgba(255,255,255,0.12)",
      align: "center",
    });
  }
  if (sheet.status === "flatlined") drain(ctx, px, py, pw, ph);
  // A little falloff at the edges, like a real print.
  const vig = ctx.createLinearGradient(px, py + ph * 0.6, px, py + ph);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vig;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();

  // The caption, in the dark ink of a felt tip.
  putFit(ctx, sheet.handle.toUpperCase(), w / 2, h - 36, w - 2 * pad - 10, {
    face: { family: MONO, weight: 600 },
    fill: PAPER_INK,
    align: "center",
    spacing: 2,
    max: 30,
    min: 16,
  });

  // The tape.
  for (const dx of [0.1, 0.9]) {
    ctx.save();
    ctx.translate(w * dx, 4);
    ctx.rotate(dx < 0.5 ? -0.5 : 0.5);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(-46, -16, 92, 32);
    ctx.restore();
  }

  stamp(ctx, sheet, w / 2, py + ph * 0.72, w > 420 ? 56 : 50);
  ctx.restore();
}

function label(ctx: Ctx, text: string, x: number, y: number, color = DIM): void {
  put(ctx, text, x, y, { size: 18, face: { family: MONO, weight: 600 }, fill: color, spacing: 4 });
}

/**
 * The words about them, in a column to the right of the picture. `compact` is
 * the 4:5 card, where the column has to fit beside a shorter picture: the
 * ability sits beside the Role and the people looking for them share a line.
 */
function identity(
  ctx: Ctx,
  sheet: RapSheet,
  x: number,
  top: number,
  width: number,
  compact: boolean,
  /** The lowest y the column may reach; used to fit the Lifepath lines into spare room. */
  limit: number,
): number {
  let y = top + 14;
  label(ctx, "ALIAS", x, y);
  y += compact ? 96 : 102;
  const handleSize = putFit(ctx, sheet.handle, x, y, width, {
    face: { family: DISPLAY, weight: 800 },
    fill: INK,
    max: compact ? 108 : 124,
    min: 48,
    glow: sheet.theme.glow,
  });
  y += Math.max(compact ? 26 : 30, 44 - (124 - handleSize) * 0.2);

  label(ctx, "NAME", x, y);
  y += compact ? 36 : 40;
  putFit(ctx, sheet.name || sheet.handle, x, y, width, {
    face: { family: MONO, weight: 600 },
    fill: INK,
    max: 32,
    min: 18,
  });
  y += compact ? 54 : 52;

  let chipW = 0;
  if (sheet.role) {
    const roleFace = { family: DISPLAY, weight: 800 };
    const text = sheet.role.toUpperCase();
    const size = fitted(ctx, text, width - 44, roleFace, 30, 18, 3).size;
    chipW = Math.min(width, widthOf(ctx, text, size, roleFace, 3) + 44);
    ctx.save();
    ctx.fillStyle = sheet.theme.accent;
    ctx.shadowColor = sheet.theme.glow;
    ctx.shadowBlur = 18;
    roundRect(ctx, x, y - size - 8, chipW, size + 22, 6);
    ctx.fill();
    ctx.restore();
    put(ctx, text, x + 22, y + 4, { size, face: roleFace, fill: "#0d0a1f", spacing: 3 });
  }
  if (sheet.ability) {
    const text = `${sheet.ability.name} · Rank ${sheet.ability.rank}`;
    const faceA = { family: MONO, weight: 500 };
    if (compact && chipW > 0) {
      putFit(ctx, text, x + chipW + 18, y + 2, width - chipW - 18, {
        face: faceA,
        fill: DIM,
        max: 21,
        min: 13,
      });
      y += 54;
    } else {
      y += chipW > 0 ? 40 : 0;
      putFit(ctx, text, x, y, width, { face: faceA, fill: DIM, max: 23, min: 15 });
      y += 50;
    }
  } else if (chipW > 0) {
    y += 52;
  }

  // Two short facts side by side, the longer one given the longer column.
  const facts = [
    sheet.readsAs ? { label: "READS AS", value: sheet.readsAs } : null,
    sheet.lastSeen,
  ].filter((f): f is { label: string; value: string } => f !== null);
  const gap = 24;
  const totalChars = facts.reduce((n, f) => n + f.value.length, 0) || 1;
  let fx = x;
  for (const fact of facts) {
    const w =
      facts.length === 1 ? width : Math.max(150, (width - gap) * (fact.value.length / totalChars));
    label(ctx, fact.label, fx, y);
    putFit(ctx, fact.value, fx, y + 32, w, {
      face: { family: MONO, weight: 600 },
      fill: INK,
      max: 26,
      min: 14,
    });
    fx += w + gap;
  }
  if (facts.length) y += compact ? 68 : 74;

  if (sheet.knownFor) {
    label(ctx, `REPUTATION ${sheet.knownFor.level}`, x, y, sheet.theme.accent);
    const lines = wrap(
      ctx,
      sheet.knownFor.line,
      width,
      { family: MONO, weight: 500 },
      22,
      compact ? 1 : 2,
    );
    lines.forEach((line, i) => {
      put(ctx, line, x, y + 30 + i * 28, {
        size: 22,
        face: { family: MONO, weight: 500 },
        fill: INK,
      });
    });
    y += 30 + lines.length * 28 + (compact ? 12 : 14);
  }

  if (sheet.wantedBy.length) {
    const text = "WANTED BY";
    const faceW = { family: MONO, weight: 600 };
    if (compact) {
      label(ctx, text, x, y, RED);
      const at = x + widthOf(ctx, text, 18, faceW, 4) + 20;
      putFit(ctx, sheet.wantedBy.join(" · ").toUpperCase(), at, y, width - (at - x), {
        face: faceW,
        fill: RED,
        max: 22,
        min: 12,
        spacing: 1,
      });
      y += 36;
    } else {
      label(ctx, text, x, y, RED);
      putFit(ctx, sheet.wantedBy.join(" · ").toUpperCase(), x, y + 32, width, {
        face: faceW,
        fill: RED,
        max: 24,
        min: 14,
        spacing: 1,
      });
      y += 60;
    }
  }

  // Whatever room is left beside the picture, the Lifepath fills: what they
  // want says more about a person than another row of numbers does.
  if (compact) {
    const order = ["WANTS", "TEMPERAMENT", "VALUES"];
    const notes = order.flatMap((l) => sheet.notes.filter((n) => n.label === l));
    for (const note of notes) {
      if (y + 56 > limit) break;
      label(ctx, note.label, x, y, sheet.theme.accent);
      putFit(ctx, note.value, x, y + 28, width, {
        face: { family: MONO, weight: 500 },
        fill: INK,
        max: 22,
        min: 13,
      });
      y += 58;
    }
  }
  return y;
}

function rule(ctx: Ctx, text: string, y: number, W: number, color = DIM): void {
  label(ctx, text, MARGIN, y, color);
  const at = MARGIN + widthOf(ctx, text, 18, { family: MONO, weight: 600 }, 4) + 20;
  ctx.save();
  ctx.fillStyle = FAINT;
  ctx.fillRect(at, y - 7, W - MARGIN - at, 2);
  ctx.restore();
}

function statBlock(ctx: Ctx, sheet: RapSheet, W: number, top: number, rowH: number): number {
  rule(ctx, "STATS", top, W);
  const gap = 56;
  const colW = (W - 2 * MARGIN - gap) / 2;
  const rows = Math.ceil(sheet.stats.length / 2);
  const startY = top + 44;
  sheet.stats.forEach((stat, i) => {
    const col = i < rows ? 0 : 1;
    const row = col === 0 ? i : i - rows;
    const x = MARGIN + col * (colW + gap);
    const y = startY + row * rowH;
    put(ctx, stat.label, x, y, {
      size: 24,
      face: { family: MONO, weight: 600 },
      fill: INK,
      spacing: 1,
    });
    const trackX = x + 92;
    const trackW = colW - 92 - 56;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, trackX, y - 17, trackW, 14, 7);
    ctx.fill();
    ctx.fillStyle = stat.color;
    ctx.shadowColor = stat.color;
    ctx.shadowBlur = 10;
    roundRect(ctx, trackX, y - 17, Math.max(10, trackW * stat.fraction), 14, 7);
    ctx.fill();
    ctx.restore();
    put(ctx, String(stat.value), x + colW, y + 2, {
      size: 32,
      face: { family: DISPLAY, weight: 800 },
      fill: stat.color,
      align: "right",
    });
  });
  return startY + (rows - 1) * rowH;
}

/** "EDGE REF 8 · DEX 7   WEAK SPOT EMP 3" — set as one line, shrunk to fit. */
function edgeLine(ctx: Ctx, sheet: RapSheet, W: number, y: number): boolean {
  if (!sheet.edge && !sheet.weak) return false;
  const width = W - 2 * MARGIN;
  const parts: { text: string; color: string }[] = [];
  if (sheet.edge) {
    parts.push({ text: "EDGE", color: CYAN }, { text: sheet.edge, color: INK });
  }
  if (sheet.weak) {
    parts.push(
      { text: sheet.weak && sheet.edge ? "    WEAK SPOT" : "WEAK SPOT", color: RED },
      { text: sheet.weak, color: INK },
    );
  }
  const face = { family: MONO, weight: 600 };
  const all = parts.map((p) => p.text).join(" ");
  let size = 26;
  while (size > 14 && widthOf(ctx, all, size, face) > width) size -= 1;
  let x = MARGIN;
  for (const part of parts) {
    put(ctx, part.text, x, y, { size, face, fill: part.color });
    x += widthOf(ctx, `${part.text} `, size, face);
  }
  return true;
}

function listLine(ctx: Ctx, heading: string, items: string[], W: number, y: number): boolean {
  if (!items.length) return false;
  const width = W - 2 * MARGIN;
  const face = { family: MONO, weight: 600 };
  put(ctx, heading, MARGIN, y, { size: 18, face, fill: DIM, spacing: 4 });
  const at = MARGIN + widthOf(ctx, heading, 18, face, 4) + 22;
  putFit(ctx, items.join(" · "), at, y, width - (at - MARGIN), {
    face: { family: MONO, weight: 500 },
    fill: INK,
    max: 24,
    min: 14,
  });
  return true;
}

function notesBlock(ctx: Ctx, sheet: RapSheet, W: number, top: number): number {
  if (!sheet.notes.length) return top;
  rule(ctx, "ON THE RECORD", top, W);
  let y = top + 46;
  for (const note of sheet.notes) {
    label(ctx, note.label, MARGIN, y, sheet.theme.accent);
    // One fitted line each: the card's height must not depend on how much a
    // player wrote, or the fullest card could not be budgeted for.
    putFit(ctx, note.value, MARGIN + 220, y + 2, W - 2 * MARGIN - 220, {
      face: { family: MONO, weight: 500 },
      fill: INK,
      max: 25,
      min: 14,
    });
    y += 46;
  }
  return y;
}

function recordTiles(ctx: Ctx, sheet: RapSheet, W: number, top: number): number {
  if (!sheet.record.length) return top;
  const gap = 20;
  const w = (W - 2 * MARGIN - gap * (sheet.record.length - 1)) / sheet.record.length;
  sheet.record.forEach((r, i) => {
    const x = MARGIN + i * (w + gap);
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.strokeStyle = FAINT;
    ctx.lineWidth = 2;
    roundRect(ctx, x, top, w, 84, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    put(ctx, r.value, x + 22, top + 60, {
      size: 54,
      face: { family: DISPLAY, weight: 800 },
      fill: INK,
    });
    put(ctx, r.label, x + w - 22, top + 54, {
      size: 20,
      face: { family: MONO, weight: 600 },
      fill: sheet.theme.accent,
      spacing: 4,
      align: "right",
    });
  });
  return top + 84 + 20;
}

function associates(
  ctx: Ctx,
  sheet: RapSheet,
  assets: RapAssets,
  W: number,
  top: number,
  face: number,
): void {
  if (!sheet.associates.length) return;
  rule(ctx, "KNOWN ASSOCIATES", top, W);
  const slot = (W - 2 * MARGIN) / 6;
  sheet.associates.slice(0, 6).forEach((who, i) => {
    const cx = MARGIN + slot * i + slot / 2;
    drawFace(ctx, who, assets.faces[who.image ?? ""] ?? null, cx - face / 2, top + 24, face);
    const tone = TONE_COLOR[who.tone];
    putFit(ctx, who.name.replace(/\s*".*?"\s*/, " ").trim(), cx, top + 24 + face + 30, slot - 10, {
      face: { family: MONO, weight: 600 },
      fill: who.tone === "dead" ? DIM : INK,
      align: "center",
      max: face > 96 ? 19 : 18,
      min: 11,
    });
    putFit(ctx, who.relation, cx, top + 24 + face + 54, slot - 10, {
      face: { family: MONO, weight: 600 },
      fill: tone,
      align: "center",
      spacing: 2,
      max: 14,
      min: 9,
    });
  });
}

function drawFace(
  ctx: Ctx,
  who: RapAssociate,
  image: CanvasImageSource | null,
  x: number,
  y: number,
  size: number,
): void {
  const ring = TONE_COLOR[who.tone];
  ctx.save();
  roundRect(ctx, x, y, size, size, 14);
  ctx.clip();
  if (image) {
    drawCover(ctx, image, x, y, size, size, 0.2);
  } else {
    ctx.fillStyle = "#1a1433";
    ctx.fillRect(x, y, size, size);
    put(ctx, (Array.from(who.name)[0] ?? "?").toUpperCase(), x + size / 2, y + size * 0.68, {
      size: size * 0.5,
      face: { family: DISPLAY, weight: 800 },
      fill: "rgba(255,255,255,0.2)",
      align: "center",
    });
  }
  if (who.tone === "dead") {
    drain(ctx, x, y, size, size);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + size - 8);
    ctx.lineTo(x + size - 8, y + 8);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 4;
  ctx.shadowColor = ring;
  ctx.shadowBlur = who.tone === "dead" ? 0 : 12;
  roundRect(ctx, x, y, size, size, 14);
  ctx.stroke();
  ctx.restore();
}

function footer(ctx: Ctx, sheet: RapSheet, W: number, ruleY: number): void {
  ctx.save();
  ctx.fillStyle = FAINT;
  ctx.fillRect(MARGIN, ruleY, W - 2 * MARGIN, 2);
  ctx.restore();
  const y = ruleY + 40;
  const face = { family: MONO, weight: 600 };
  put(ctx, "MEET YOUR FIXER", MARGIN, y, { size: 22, face, fill: sheet.theme.accent, spacing: 4 });
  const at = MARGIN + widthOf(ctx, "MEET YOUR FIXER", 22, face, 4) + 26;
  const host = SITE_URL.replace(/^https?:\/\//, "").toUpperCase();
  putFit(ctx, host, at, y, W - MARGIN - 200 - at, {
    face: { family: MONO, weight: 500 },
    fill: DIM,
    max: 21,
    min: 12,
    spacing: 2,
  });
  barcode(ctx, sheet.fileNo, W - MARGIN - 170, y - 24, 170, 34, DIM);
}

function overlay(ctx: Ctx, sheet: RapSheet, W: number, H: number): void {
  // Scanlines, and a vignette, over everything.
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.028)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.45, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // HUD brackets in the corners.
  ctx.save();
  ctx.strokeStyle = sheet.theme.accent;
  ctx.lineWidth = 4;
  ctx.shadowColor = sheet.theme.glow;
  ctx.shadowBlur = 10;
  const i = 26;
  const l = 46;
  const corner = (x: number, y: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x + dx * l, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * l);
    ctx.stroke();
  };
  corner(i, i, 1, 1);
  corner(W - i, i, -1, 1);
  corner(i, H - i, 1, -1);
  corner(W - i, H - i, -1, -1);
  ctx.restore();
}

/**
 * Where things go, per shape. Heights are budgets, not guesses: the post has to
 * fit a column of words beside a picture, a ladder of STATs and six faces into
 * 1350 pixels, and every number here was set against a render of the fullest
 * card there can be (a campaign, chrome, a grudge, six people).
 */
const LAYOUT = {
  post: {
    headerY: 56,
    titleY: 190,
    titleSize: 118,
    picW: 400,
    picH: 452,
    picGap: 40,
    afterPic: 30,
    statRow: 36,
    afterStats: 42,
    lineStep: 34,
    face: 92,
    compact: true,
  },
  story: {
    headerY: 80,
    titleY: 236,
    titleSize: 140,
    picW: 440,
    picH: 520,
    picGap: 44,
    afterPic: 28,
    statRow: 40,
    afterStats: 44,
    lineStep: 36,
    face: 104,
    compact: false,
  },
} as const;

/** Draw the whole card onto a context sized to the format. */
export function drawRapSheet(
  ctx: Ctx,
  sheet: RapSheet,
  assets: RapAssets,
  format: RapFormat,
): void {
  const { width: W, height: H } = RAP_FORMATS[format];
  const L = LAYOUT[format];
  const story = format === "story";

  background(ctx, sheet, W, H);
  header(ctx, sheet, W, L.headerY);
  title(ctx, sheet, W, L.titleY, L.titleSize);

  // The picture, and who it is of.
  const top = L.titleY + (story ? 58 : 44);
  polaroid(ctx, sheet, assets, MARGIN, top, L.picW, L.picH);
  const idX = MARGIN + L.picW + L.picGap;
  const idBottom = identity(
    ctx,
    sheet,
    idX,
    top - 2,
    W - MARGIN - idX,
    L.compact,
    top + L.picH - 4,
  );

  let y = Math.max(top + L.picH + 14, idBottom) + L.afterPic;
  if (story) {
    y = recordTiles(ctx, sheet, W, y) + 4;
    y = notesBlock(ctx, sheet, W, y + 4) + 6;
  }

  const lastRowY = statBlock(ctx, sheet, W, y, L.statRow);
  let ly = lastRowY + L.afterStats;
  if (edgeLine(ctx, sheet, W, ly)) ly += L.lineStep;
  const skills = sheet.skills.map((s2) => `${s2.name} ${s2.level}`);
  if (listLine(ctx, "SKILLS", skills, W, ly)) ly += L.lineStep;
  if (story && listLine(ctx, "CHROME", sheet.chrome, W, ly)) ly += L.lineStep;

  // The people and the footer are anchored to the bottom, so a card with less
  // on it leaves its gap in the middle and never loses the faces.
  const footerRule = H - 84;
  const assocTop = footerRule - 16 - (L.face + 112);
  associates(ctx, sheet, assets, W, Math.max(assocTop, ly + 6), L.face);
  footer(ctx, sheet, W, footerRule);
  overlay(ctx, sheet, W, H);
}
