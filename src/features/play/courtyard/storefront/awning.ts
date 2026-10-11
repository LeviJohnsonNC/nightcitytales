/** The storefront's canvas awning and its valance sign. See `../storefront.ts`. */
import type { Point } from "@/engine";
import { sourceFor } from "../architectureArt";
import { INTERSECTION_NIGHT, lightColor } from "../nightLighting";
import { STOREFRONT_LEVELS as L } from "../storefrontPack";
import { patternMatrix } from "../surfaceMaterials";
import { fillPoly, gradientFill, path, strokeLine } from "./draw";
import { drawOnFace, lightKanji, tintedMask } from "./face";
import { streetLamp } from "./lamp";
import { facePoint, type FaceOptions, type Storefront } from "./model";

/**
 * The canvas awning, on the saved attachment: a sloped plane from the wall line at
 * 2.7 m to the outer edge at 2.45 m, the fabric repeated along the span, a hem and
 * two arms. Drawn as its own sprite so it can sort by its footprint and fade for
 * actors under it.
 */
export function paintAwning(o: Omit<FaceOptions, "clip">) {
  const { ctx, sf, ppm } = o;
  const at = facePoint(sf, o.project, ppm);
  const { offset, span, projection } = sf.awning;
  const wall = L.awningWall;
  const outer = L.awningOuter;
  const hem = AWNING_HEM;
  const top = [
    at(offset, 0, wall),
    at(offset + span, 0, wall),
    at(offset + span, projection, outer),
    at(offset, projection, outer),
  ];
  const valance = [
    at(offset, projection, outer),
    at(offset + span, projection, outer),
    at(offset + span, projection, outer - hem),
    at(offset, projection, outer - hem),
  ];
  // Boxed fabric ends and metal edging give the canopy a constructed profile.
  // All planes remain within the saved awning footprint and existing hem height.
  const cheeks = [offset, offset + span].map((s) => [
    at(s, 0, wall),
    at(s, projection, outer),
    at(s, projection, outer - hem),
    at(s, 0, wall - 0.45),
  ]);
  if (o.pass !== "albedo") {
    if (o.pass === "light") for (const cheek of cheeks) paintAwningLight(o, cheek);
    paintAwningLight(o, [...top.slice(0, 3), valance[2]!, valance[3]!]);
    return;
  }
  const slope = Math.hypot(projection, wall - outer);
  const canvasM = 1.6;
  // fabric pattern: u along the span, v down the slope, anchored at the wall edge
  const o0 = at(offset, 0, wall);
  const alongS = at(offset + 1, 0, wall);
  const downSlope = at(offset, projection, outer);
  const basis = {
    origin: o0,
    u: { x: alongS.x - o0.x, y: alongS.y - o0.y },
    v: { x: (downSlope.x - o0.x) / slope, y: (downSlope.y - o0.y) / slope },
  };
  const paintFabric = (pts: Point[], shade: string, from: number) => {
    const fabric = o.art.paintedCanopy ?? o.art.awning;
    const transform = ctx.getTransform?.();
    const deviceSize = (v: Point) =>
      canvasM *
      Math.hypot(
        (transform?.a ?? 1) * v.x + (transform?.c ?? 0) * v.y,
        (transform?.b ?? 0) * v.x + (transform?.d ?? 1) * v.y,
      );
    const canopy = fabric ? sourceFor(fabric, deviceSize(basis.u), deviceSize(basis.v)) : undefined;
    if (canopy) {
      const pattern = ctx.createPattern(canopy, "repeat");
      if (pattern) {
        pattern.setTransform(
          patternMatrix(
            { ...basis, origin: { x: o0.x + basis.v.x * from, y: o0.y + basis.v.y * from } },
            canvasM,
            canopy.width,
          ),
        );
        ctx.save();
        path(ctx, pts);
        ctx.clip();
        ctx.fillStyle = pattern;
        ctx.fill();
        ctx.fillStyle = shade;
        ctx.fill();
        ctx.restore();
        return;
      }
    }
    fillPoly(ctx, pts, "#527b76");
  };
  // The continuous underside and front beam give the canopy real weight at play
  // scale. All supports stop above head height, within its existing saved envelope.
  fillPoly(
    ctx,
    [
      at(offset, 0, wall - 0.3),
      at(offset + span, 0, wall - 0.3),
      at(offset + span, projection, outer - hem),
      at(offset, projection, outer - hem),
    ],
    "#182b29",
  );
  for (let s = offset + 0.12; s < offset + span; s += 2.6) {
    strokeLine(
      ctx,
      at(s, 0, wall - 0.65),
      at(s, projection - 0.08, outer - hem),
      "#172323",
      ppm * 0.09,
    );
    strokeLine(
      ctx,
      at(s, 0, wall - 0.64),
      at(s, projection - 0.08, outer - hem + 0.03),
      "#737563",
      ppm * 0.025,
    );
  }
  // arms first: they run under the fabric from the wall to the outer corners
  for (const s of [offset + 0.05, offset + span - 0.05])
    strokeLine(ctx, at(s, 0, wall - 0.55), at(s, projection - 0.05, outer - 0.02), "#222d31", 2.4);
  cheeks.forEach((cheek, i) => {
    fillPoly(ctx, cheek, i === 0 ? "#374039" : "#242e2b");
    strokeLine(ctx, cheek[3]!, cheek[2]!, "#111d20", 2.2);
    strokeLine(ctx, cheek[0]!, cheek[3]!, "#788274", 1.3);
    // Diagonal brace is fixed to the cheek rather than hanging in empty space.
    strokeLine(ctx, cheek[3]!, cheek[1]!, "#69766b", 1.2);
  });
  paintFabric(top, "rgba(0,0,0,.10)", 0);
  // light is higher at the wall edge and falls off down the slope
  gradientFill(ctx, top, at(offset, 0, wall), at(offset, projection, outer), [
    [0, "rgba(255,255,255,.07)"],
    [1, "rgba(0,0,0,.14)"],
  ]);
  // Tension ribs separate broad cloth panels at the actual play camera scale.
  for (let i = 1; i < 4; i++) {
    const s = offset + (span * i) / 4;
    strokeLine(ctx, at(s, 0, wall), at(s, projection, outer), "rgba(15,28,28,.48)", 1.4);
    strokeLine(
      ctx,
      at(s + 0.025, 0, wall),
      at(s + 0.025, projection, outer),
      "rgba(204,193,153,.3)",
      0.7,
    );
  }
  // the hem folds over the front: the same cloth, darker, with its own stripe phase
  paintFabric(valance, "rgba(0,0,0,.42)", slope);
  fillPoly(
    ctx,
    [
      at(offset, projection, outer - hem),
      at(offset + span, projection, outer - hem),
      at(offset + span, projection - 0.13, outer - hem - 0.08),
      at(offset, projection - 0.13, outer - hem - 0.08),
    ],
    "#172725",
  );
  strokeLine(ctx, valance[3]!, valance[2]!, "#1b2428", 1.6);
  strokeLine(ctx, top[0]!, top[1]!, "#1b2428", 1.4);
  for (const s of [offset, offset + span]) {
    strokeLine(ctx, at(s, 0, wall), at(s, projection, outer), "#1b2428", 1.1);
    strokeLine(ctx, at(s, projection, outer), at(s, projection, outer - hem), "#1b2428", 1.1);
  }
  // the shop's name, small, in neon tubes on the valance: the one sign the cutaway keeps
  if (o.art.kanji && sf.awning.id !== "market-return-canopy") {
    // a dark lightbox strip on the valance, and the tubes on it, unlit
    const g = valanceGlyphs(sf);
    fillPoly(
      ctx,
      [
        at(g.s - 0.08, g.out, g.zTop + 0.025),
        at(g.s + g.width + 0.08, g.out, g.zTop + 0.025),
        at(g.s + g.width + 0.08, g.out, g.zTop - g.height - 0.025),
        at(g.s - 0.08, g.out, g.zTop - g.height - 0.025),
      ],
      "#12161c",
    );
    drawOnFace(o, tintedMask(o.art.kanji, "#7a3443"), g.s, g.zTop, g.width, g.height, g.out);
  }
}

/**
 * The awning's valance is 0.32 m deep, to carry four 0.25 m glyphs. A vertical
 * surface this shallow is a few pixels tall from this camera, so the sign is a
 * glowing band that reads as lettering only up close; it is the one sign the
 * cutaway keeps.
 */
const AWNING_HEM = 0.32;
const VALANCE_CELL = 0.25;

/** The valance sign, centred on the canopy. */
function valanceGlyphs(sf: Storefront) {
  const { offset, span, projection } = sf.awning;
  const width = 4 * VALANCE_CELL;
  const centre = offset + span / 2;
  return {
    s: centre - width / 2,
    zTop: L.awningOuter - (AWNING_HEM - VALANCE_CELL) / 2,
    width,
    height: VALANCE_CELL,
    out: projection + 0.005,
  };
}

function paintAwningLight(o: Omit<FaceOptions, "clip">, outline: Point[]) {
  const { ctx, sf, ppm } = o;
  const at = facePoint(sf, o.project, ppm);
  if (o.pass === "light") {
    const lamp = streetLamp(sf);
    if (!lamp) return;
    // the streetlight on the canvas, strongest at the end nearest it
    const c = at(lamp.s, Math.min(sf.awning.projection, Math.max(0, lamp.outM)), L.awningWall);
    const r = 3.6 * ppm;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    g.addColorStop(0, lightColor(INTERSECTION_NIGHT.lamp.color, 0.7));
    g.addColorStop(0.5, lightColor(INTERSECTION_NIGHT.lamp.color, 0.22));
    g.addColorStop(1, lightColor(INTERSECTION_NIGHT.lamp.color, 0));
    path(ctx, outline);
    ctx.fillStyle = g;
    ctx.fill();
    return;
  }
  if (o.art.kanji && sf.awning.id !== "market-return-canopy") {
    const g = valanceGlyphs(sf);
    lightKanji(o, o.art.kanji, g, g.out, 3 * Math.max(1, ppm / 12), 0.012);
  }
}
