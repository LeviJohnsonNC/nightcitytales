/** Small reusable furniture kit. Geometry is registered to one canonical 2m section. */
import type Phaser from "phaser";
import { propTexture, type PropKind, type PropCondition } from "./propPresentation";
export const INTERIOR_PROP_KINDS = [
  "sedan-engine",
  "sedan-cabin",
  "desk",
  "desk-reverse",
  "seat-reverse",
  "waiting-seat",
  "waiting-seat-reverse",
  "conference-table",
  "cabinet",
  "stock",
  "speaker",
  "reception",
  "meeting-table",
  "seat",
  "bar",
  "backbar",
  "lounge-table",
  "server",
  "shelf",
  "dj",
  "partition",
  "workbench",
  "planter",
  "mailboxes",
  "shop-display",
] as const;
export function isInteriorProp(kind: PropKind) {
  return (INTERIOR_PROP_KINDS as readonly string[]).includes(kind);
}

export function createInteriorPropTextures(
  scene: Phaser.Scene,
  kind: PropKind,
  rotation: 0 | 90 = 0,
) {
  for (const condition of ["intact", "damaged", "wrecked"] as PropCondition[]) {
    const height = 240;
    const texture = scene.textures.createCanvas(
      propTexture(kind, condition) + (rotation === 90 ? "-90" : ""),
      256,
      height,
    )!;
    const ctx = texture.context;
    const vehicle = kind === "sedan-engine" || kind === "sedan-cabin";
    const point = (x: number, y: number, z = 0) => {
      if (rotation === 90) [x, y] = [2 - y, x];
      const rise = vehicle ? 64 / Math.sqrt(3) : 32;
      return { x: (x + y) * 64, y: height - 2 * rise + (x - y) * rise - z };
    };
    const poly = (points: ReturnType<typeof point>[], color: string, stroke = "#172027") => {
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    const slab = (
      x: number,
      y: number,
      w: number,
      d: number,
      bottom: number,
      top: number,
      colors: string[],
    ) => {
      const footprint =
        rotation === 90
          ? [
              [x, y + d],
              [x, y],
              [x + w, y],
              [x + w, y + d],
            ]
          : [
              [x, y],
              [x + w, y],
              [x + w, y + d],
              [x, y + d],
            ];
      const [a, b, c] = footprint.map(([u, v]) => point(u!, v!, bottom));
      const [A, B, C, D] = footprint.map(([u, v]) => point(u!, v!, top));
      poly([a!, b!, B!, A!], colors[0]!);
      poly([b!, c!, C!, B!], colors[1]!);
      poly([A!, B!, C!, D!], colors[2]!);
    };
    poly(
      [point(0.1, 0.1), point(1.9, 0.1), point(1.9, 1.9), point(0.1, 1.9)],
      "rgba(0,0,0,.23)",
      "transparent",
    );
    if (condition === "wrecked") {
      for (let i = 0; i < 7; i++)
        slab(0.15 + (i % 3) * 0.53, 0.15 + Math.floor(i / 3) * 0.55, 0.4, 0.35, 0, 4 + (i % 3), [
          "#4d4440",
          "#323a41",
          "#74665b",
        ]);
      texture.refresh();
      continue;
    }
    const metal = ["#4f626a", "#283c48", "#73878a"],
      wood = ["#766656", "#493f39", "#ac9270"],
      velvet = ["#624052", "#38293e", "#a56883"];
    if (kind === "sedan-engine" || kind === "sedan-cabin") {
      const engine = kind === "sedan-engine";
      const body = ["#74644b", "#493f32", "#a38c62"];
      // Canonical car runs along x: engine occupies x=0..2, cabin x=2..4.
      // Both modules reach the shared boundary at identical sill/hood heights.
      for (const y of [0.08, 1.7])
        slab(engine ? 0.42 : 1.1, y, 0.55, 0.22, 0, 25, ["#171f25", "#10191f", "#303a40"]);
      slab(engine ? 0.12 : 0, 0.2, engine ? 1.88 : 1.86, 1.6, 16, 46, body);
      if (!engine) {
        slab(0.05, 0.32, 1.25, 1.36, 46, 83, body);
        if (rotation === 0) {
          poly(
            [
              point(0.13, 0.31, 52),
              point(1.2, 0.31, 52),
              point(1.2, 0.31, 76),
              point(0.13, 0.31, 76),
            ],
            "#28434b",
          );
          poly(
            [
              point(1.31, 0.42, 52),
              point(1.31, 1.58, 52),
              point(1.31, 1.58, 76),
              point(1.31, 0.42, 76),
            ],
            "#28434b",
          );
        } else {
          poly(
            [
              point(0.04, 0.42, 52),
              point(0.04, 1.58, 52),
              point(0.04, 1.58, 76),
              point(0.04, 0.42, 76),
            ],
            "#28434b",
          );
          poly(
            [
              point(0.13, 0.31, 52),
              point(1.2, 0.31, 52),
              point(1.2, 0.31, 76),
              point(0.13, 0.31, 76),
            ],
            "#28434b",
          );
        }
        slab(1.79, 0.3, 0.09, 1.4, 28, 36, ["#883e39", "#542721", "#a95644"]);
      } else {
        slab(0.08, 0.18, 0.12, 1.64, 17, 27, metal);
        for (const y of [0.28, 1.3])
          slab(0.06, y, 0.09, 0.36, 30, 40, ["#d6c797", "#958761", "#efe0ac"]);
        slab(0.55, 0.95, 1.35, 0.12, 46, 47, metal);
      }
    } else if (kind === "planter") {
      slab(0.12, 0.12, 1.76, 1.76, 0, 32, ["#77736a", "#514f4a", "#a7a38f"]);
      slab(0.28, 0.28, 1.44, 1.44, 32, 35, ["#393c32", "#30362c", "#4c5340"]);
      for (let i = 0; i < 12; i++) {
        const p = point(0.4 + (i % 3) * 0.4, 0.4 + Math.floor(i / 3) * 0.3, 42 + (i % 3) * 4);
        ctx.fillStyle = i % 2 ? "#647b4e" : "#81935b";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 12, 7, i * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === "mailboxes") {
      slab(0.12, 0.4, 1.76, 0.9, 0, 76, metal);
      for (const z of [8, 29, 50])
        for (const x of [0.2, 0.75, 1.3]) {
          slab(x, 0.35, 0.48, 0.05, z, z + 18, ["#8d9695", "#59686b", "#bbc3bd"]);
          slab(x + 0.06, 0.31, 0.33, 0.04, z + 12, z + 14, ["#192c35", "#192c35", "#192c35"]);
          slab(x + 0.32, 0.3, 0.07, 0.04, z + 4, z + 7, wood);
        }
    } else if (kind === "shop-display") {
      // Tiered goods and a striped canopy identify retail without extra props.
      for (const y of [0.25, 0.95]) {
        const z = y < 0.5 ? 25 : 48;
        slab(0.12, y, 1.76, 0.6, 0, z, wood);
        for (let i = 0; i < 4; i++)
          slab(
            0.2 + i * 0.4,
            y + 0.08,
            0.3,
            0.38,
            z,
            z + 13,
            i % 2 ? ["#87603c", "#5b482e", "#d1a360"] : ["#697342", "#40513c", "#a6ad6b"],
          );
      }
      for (const x of [0.12, 1.8]) slab(x, 1.65, 0.08, 0.12, 0, 94, metal);
      for (let i = 0; i < 6; i++)
        slab(
          i / 3,
          0.1,
          1 / 3,
          1.8,
          92,
          97,
          i % 2 ? ["#a55a38", "#733b30", "#c5754d"] : ["#aaa080", "#776f59", "#d0c5a1"],
        );
    } else if (kind === "speaker") {
      slab(0.25, 0.4, 1.5, 1.2, 0, 80, ["#20232d", "#141a23", "#414454"]);
      for (const z of [22, 58]) {
        const p = point(1, 0.38, z);
        ctx.fillStyle = "#070b12";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 20, 16, 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#71547a";
        ctx.stroke();
      }
    } else if (kind === "cabinet") {
      slab(0.12, 0.35, 1.76, 1.3, 0, 64, ["#666d68", "#3d4949", "#93958a"]);
      for (const z of [10, 28, 46]) {
        slab(0.2, 0.3, 1.6, 0.06, z, z + 14, metal);
        slab(0.8, 0.25, 0.4, 0.08, z + 6, z + 8, wood);
      }
      slab(0.3, 0.7, 0.5, 0.7, 64, 67, wood);
    } else if (kind === "backbar") {
      slab(0, 0.2, 2, 1.6, 0, 46, metal);
      for (const z of [48, 70]) {
        slab(0, 0.4, 2, 1.4, z - 4, z, wood);
        for (let i = 0; i < 5; i++)
          slab(0.18 + i * 0.35, 0.55, 0.16, 0.2, z, z + 13, ["#43837c", "#275554", "#78aaa1"]);
      }
    } else if (kind === "lounge-table") {
      slab(0.8, 0.8, 0.4, 0.4, 0, 24, metal);
      slab(0.15, 0.15, 1.7, 1.7, 24, 29, wood);
      for (const x of [0.5, 1.3]) slab(x, 0.8, 0.13, 0.15, 29, 36, metal);
    } else if (kind === "stock") {
      for (let i = 0; i < 4; i++) {
        const x = 0.15 + (i % 2) * 0.85,
          y = 0.15 + Math.floor(i / 2) * 0.85;
        slab(x, y, 0.75, 0.75, 0, 20 + (i % 3) * 10, wood);
      }
    } else if (kind === "desk" || kind === "desk-reverse") {
      const deskSlab: typeof slab = (x, y, w, d, bottom, top, colors) =>
        slab(
          kind === "desk-reverse" ? 2 - x - w : x,
          kind === "desk-reverse" ? 2 - y - d : y,
          w,
          d,
          bottom,
          top,
          colors,
        );
      // A complete workstation fits inside its canonical section: chair,
      // desk, terminal and small working clutter, rather than a lone table.
      for (const x of [0.15, 1.75]) deskSlab(x, 0.85, 0.1, 1, 0, 34, metal);
      deskSlab(0.05, 0.8, 1.9, 1.1, 32, 38, wood);
      deskSlab(0.65, 1.6, 0.75, 0.15, 38, 61, metal);
      deskSlab(0.65, 1.57, 0.7, 0.03, 42, 57, ["#62b4bd", "#62b4bd", "#62b4bd"]);
      deskSlab(0.65, 1.05, 0.7, 0.3, 38, 40, metal);
      deskSlab(0.15, 1.1, 0.3, 0.45, 38, 41, ["#b2b8ae", "#929c92", "#e2d8ba"]);
      deskSlab(0.65, 0.12, 0.7, 0.6, 0, 19, metal);
      deskSlab(0.6, 0.08, 0.8, 0.65, 19, 26, velvet);
      deskSlab(0.6, 0.05, 0.8, 0.12, 26, 48, velvet);
    } else if (kind === "conference-table") {
      // Full-width modules meet at the canonical section boundary. Chairs fit
      // inside each section; seating approaches outside remain actual clear floor.
      for (const y of [0.05, 1.5]) {
        slab(0.65, y, 0.7, 0.4, 0, 23, metal);
        slab(0.62, y, 0.76, 0.4, 23, 27, velvet);
        slab(0.62, y < 1 ? y : y + 0.32, 0.76, 0.08, 27, 47, velvet);
      }
      for (const x of [0.4, 1.5]) slab(x, 0.8, 0.12, 0.4, 0, 34, metal);
      slab(0, 0.55, 2, 0.9, 34, 40, wood);
      slab(0.7, 0.85, 0.45, 0.35, 40, 42, ["#adb8b9", "#73888d", "#d0d5ce"]);
    } else if (kind === "shelf") {
      for (const x of [0.1, 1.8]) for (const y of [0.2, 1.6]) slab(x, y, 0.1, 0.1, 0, 94, metal);
      for (const z of [12, 45, 78]) {
        slab(0.1, 0.2, 1.8, 1.5, z, z + 3, metal);
        for (let i = 0; i < 2; i++) slab(0.25 + i * 0.8, 0.45, 0.6, 1, z + 3, z + 23, wood);
      }
    } else if (kind === "server" || kind === "partition") {
      const tall = kind === "partition" ? 65 : 92;
      slab(0.15, 0.25, 1.7, 1.5, 0, tall, metal);
      for (let z = 15; z < tall - 5; z += 17) {
        poly(
          [
            point(0.3, 0.24, z),
            point(1.7, 0.24, z),
            point(1.7, 0.24, z + 9),
            point(0.3, 0.24, z + 9),
          ],
          "#14262e",
        );
        const p = point(1.45, 0.23, z + 5);
        ctx.fillStyle = "#6de0c4";
        ctx.fillRect(p.x, p.y, 4, 3);
      }
    } else if (["seat", "seat-reverse", "waiting-seat", "waiting-seat-reverse"].includes(kind)) {
      const reverse = kind.endsWith("reverse"),
        waiting = kind.startsWith("waiting-");
      const seatSlab: typeof slab = (x, y, w, d, bottom, top, colors) =>
        slab(reverse ? 2 - x - w : x, reverse ? 2 - y - d : y, w, d, bottom, top, colors);
      const width = waiting ? 1.2 : 1.8;
      seatSlab(0.1, 0.2, width, 1.5, 0, 19, metal);
      seatSlab(0.12, 0.2, width - 0.04, 1.5, 19, 32, velvet);
      seatSlab(0.12, 1.55, width - 0.04, 0.24, 30, 62, velvet);
      for (const x of [0.15, width - 0.15]) seatSlab(x, 0.25, 0.2, 1.4, 24, 43, velvet);
      if (waiting) {
        seatSlab(1.48, 0.5, 0.4, 0.8, 0, 24, wood);
        seatSlab(1.51, 0.62, 0.28, 0.45, 24, 27, ["#778e95", "#586e78", "#cad5ce"]);
      }
    } else {
      const counter = kind === "bar" || kind === "reception" || kind === "workbench";
      if (counter) slab(0.05, 0.15, 1.9, 1.65, 0, 48, kind === "bar" ? velvet : metal);
      else
        for (const x of [0.2, 1.65])
          for (const y of [0.2, 1.65]) slab(x, y, 0.12, 0.12, 0, 32, metal);
      const top = counter ? 54 : 38;
      slab(kind === "bar" ? 0 : 0.05, 0.15, kind === "bar" ? 2 : 1.9, 1.65, top - 6, top, wood);
      if (kind === "reception") {
        // A continuous raised visitor ledge reads as a reception counter;
        // the terminal and keyboard occupy the staff side behind it.
        slab(0, 0.12, 2, 0.28, top, top + 18, metal);
        slab(0.65, 1.15, 0.75, 0.18, top, top + 24, metal);
        poly(
          [
            point(0.68, 1.14, top + 3),
            point(1.36, 1.14, top + 3),
            point(1.36, 1.14, top + 21),
            point(0.68, 1.14, top + 21),
          ],
          "#62b4bd",
        );
        slab(0.7, 1.5, 0.65, 0.3, top, top + 2, metal);
      }
      if (kind === "workbench") {
        slab(0.1, 1.55, 1.8, 0.12, top, top + 32, metal);
        for (let i = 0; i < 5; i++) {
          const p = point(0.3 + i * 0.3, 1.52, top + 22);
          ctx.strokeStyle = "#dcc07b";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + 10);
          ctx.stroke();
        }
        slab(0.3, 0.45, 0.6, 0.5, top, top + 8, metal);
      }
      if (kind === "bar")
        for (let i = 0; i < 3; i++)
          slab(0.35 + i * 0.43, 1.3, 0.13, 0.15, top, top + 12, ["#43837c", "#275554", "#78aaa1"]);
      if (kind === "meeting-table") {
        slab(0.4, 0.7, 0.4, 0.5, top, top + 2, ["#687c88", "#465869", "#b3c3c7"]);
        const p = point(1.3, 0.7, top + 2);
        ctx.fillStyle = "#ddd2b0";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (kind === "dj") {
        slab(0.2, 0.35, 1.6, 1.2, top, top + 7, metal);
        for (const x of [0.65, 1.4]) {
          const p = point(x, 0.9, top + 8);
          ctx.fillStyle = "#101a2a";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 17, 9, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#b176bf";
          ctx.stroke();
        }
      }
    }
    if (condition === "damaged") {
      ctx.strokeStyle = "#211f28";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(65, 150);
      ctx.lineTo(112, 163);
      ctx.lineTo(109, 190);
      ctx.stroke();
      ctx.fillStyle = "#b5a27b";
      ctx.fillRect(165, 165, 5, 3);
    }
    texture.refresh();
  }
}
