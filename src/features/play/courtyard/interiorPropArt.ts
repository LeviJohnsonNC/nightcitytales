import { fillMaterial, type MaterialSet } from "./surfaceMaterials";
/** Small reusable furniture kit. Geometry is registered to one canonical 2m section. */
import type Phaser from "phaser";
import { propTexture, type PropKind, type PropCondition } from "./propPresentation";
import { PROP_CANVAS, PROP_PIXELS_PER_METRE, propHeightMetres } from "./sceneArtMetrics";
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

/** The canonical 2m tile must use the same 30-degree projection as the board. */
export function interiorPropPoint(x: number, y: number, z = 0, rotation: 0 | 90 = 0) {
  if (rotation === 90) [x, y] = [2 - y, x];
  const rise = 64 / Math.sqrt(3);
  return { x: (x + y) * 64, y: PROP_CANVAS.groundY - 2 * rise + (x - y) * rise - z };
}

export function createInteriorPropTextures(
  scene: Phaser.Scene,
  kind: PropKind,
  rotation: 0 | 90 = 0,
  /** The flat footprint shadow under the prop; off where the board draws contact shade. */
  bakedShadow = true,
  materials?: MaterialSet,
  office = false,
  nightclub = false,
) {
  for (const condition of ["intact", "damaged", "wrecked"] as PropCondition[]) {
    const height = PROP_CANVAS.height;
    const texture = scene.textures.createCanvas(
      propTexture(kind, condition) + (rotation === 90 ? "-90" : ""),
      256,
      height,
    )!;
    const ctx = texture.context;
    const point = (x: number, y: number, z = 0) =>
      interiorPropPoint(x, y, propHeightMetres(kind, z) * PROP_PIXELS_PER_METRE, rotation);
    const poly = (points: ReturnType<typeof point>[], color: string, stroke = "#172027") => {
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = materials ? 0.7 : 2;
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
      const face = (
        points: ReturnType<typeof point>[],
        color: string,
        width: number,
        depth: number,
      ) => {
        poly(points, color);
        if (!materials) return;
        const origin = points[0]!,
          u = points[1]!,
          v = points[3]!;
        fillMaterial(ctx, materials, points, {
          key: "painted-metal",
          target: color,
          strength: 0.35,
          basis: {
            origin,
            u: { x: (u.x - origin.x) / width, y: (u.y - origin.y) / width },
            v: { x: (v.x - origin.x) / depth, y: (v.y - origin.y) / depth },
          },
        });
        // A restrained worn edge gives the small parts thickness at play zoom.
        ctx.strokeStyle = "rgba(203,208,184,.26)";
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.moveTo(points[2]!.x, points[2]!.y);
        ctx.lineTo(points[3]!.x, points[3]!.y);
        ctx.stroke();
      };
      const h = propHeightMetres(kind, top - bottom);
      face([a!, b!, B!, A!], colors[0]!, rotation === 90 ? d : w, h);
      face([b!, c!, C!, B!], colors[1]!, rotation === 90 ? w : d, h);
      face([A!, B!, C!, D!], colors[2]!, rotation === 90 ? d : w, rotation === 90 ? w : d);
    };
    if (bakedShadow)
      poly(
        [point(0.1, 0.1), point(1.9, 0.1), point(1.9, 1.9), point(0.1, 1.9)],
        "rgba(0,0,0,.23)",
        "transparent",
      );
    if (condition === "wrecked") {
      // Walkable remains retain the object's footprint and material identity.
      // They are drawn low here, never by squashing the entire texture at display time.
      const car = kind.startsWith("sedan-");
      const timber = [
        "desk",
        "desk-reverse",
        "conference-table",
        "meeting-table",
        "lounge-table",
        "stock",
      ].includes(kind);
      const upholstery = kind.includes("seat");
      const remains = car
        ? ["#514b40", "#30363a", "#837457"]
        : timber
          ? ["#68513c", "#40382f", "#967958"]
          : upholstery
            ? office
              ? ["#40554b", "#293d36", "#687967"]
              : ["#543444", "#332936", "#88566b"]
            : ["#48565a", "#2a353b", "#708080"];
      if (car) {
        slab(
          kind === "sedan-engine" ? 0.12 : 0,
          0.2,
          kind === "sedan-engine" ? 1.88 : 1.86,
          1.6,
          0,
          9,
          remains,
        );
        slab(0.35, 0.45, 1.15, 0.95, 9, 13, ["#282e32", "#19252d", "#454d50"]);
        for (const y of [0.08, 1.7])
          slab(0.55, y, 0.5, 0.2, 0, 10, ["#181e23", "#10191f", "#303a40"]);
      } else if (upholstery) {
        // Torn cushions beside a collapsed frame, rather than a solid crate.
        slab(0.16, 0.3, 1.6, 0.12, 0, 5, remains);
        slab(0.22, 1.48, 1.45, 0.12, 0, 6, remains);
        slab(0.2, 0.4, 0.63, 0.85, 0, 10, remains);
        slab(1.02, 0.64, 0.7, 0.75, 0, 7, remains);
        poly(
          [point(0.32, 0.62, 10.2), point(0.66, 0.72, 10.2), point(0.48, 0.97, 10.2)],
          "#b2a27c",
        );
        slab(0.4, 1.62, 1.14, 0.18, 0, 12, remains);
      } else if (timber || kind === "bar" || kind === "reception" || kind === "workbench") {
        const boards = ["#70523b", "#44372e", "#a08560"];
        // Broken top leaves a gap through the original counter/table footprint.
        poly(
          [
            point(0.08, 0.25, 5),
            point(1.0, 0.25, 8),
            point(0.82, 0.88, 7),
            point(1.08, 1.28, 6),
            point(0.08, 1.65, 3),
          ],
          boards[2]!,
        );
        poly(
          [
            point(1.2, 0.32, 4),
            point(1.89, 0.25, 4),
            point(1.89, 1.6, 8),
            point(1.03, 1.56, 8),
            point(1.28, 0.92, 5),
          ],
          boards[0]!,
        );
        for (const x of [0.28, 1.5]) slab(x, 0.48, 0.12, 0.95, 0, 4, remains);
        if (kind === "bar") {
          for (const x of [0.22, 0.62, 1.25])
            slab(x, 0.2, 0.16, 0.42, 0, 4, ["#355d56", "#203b3b", "#719284"]);
          slab(0.15, 1.6, 1.65, 0.12, 0, 8, boards);
        } else if (["desk", "desk-reverse", "reception"].includes(kind)) {
          slab(0.7, 0.65, 0.76, 0.6, 7, 10, ["#24343a", "#18252a", "#3e5156"]);
          poly(
            [
              point(0.76, 0.71, 10.2),
              point(1.39, 0.71, 10.2),
              point(1.39, 1.18, 10.2),
              point(0.76, 1.18, 10.2),
            ],
            "#172b31",
          );
        }
      } else if (["cabinet", "server", "backbar", "shelf", "mailboxes"].includes(kind)) {
        // Open carcass, exposed shelves and a loose panel retain storage identity.
        slab(0.18, 0.32, 1.55, 1.25, 0, 3, remains);
        for (const x of [0.2, 1.6]) slab(x, 0.35, 0.1, 1.2, 3, 13, remains);
        for (const y of [0.55, 0.98, 1.45]) slab(0.3, y, 1.3, 0.07, 3, 10, remains);
        slab(0.48, 0.08, 1.2, 0.35, 0, 5, remains);
      } else if (kind === "speaker" || kind === "dj") {
        slab(0.25, 0.38, 1.45, 1.2, 0, 9, ["#282c32", "#151e25", "#41454a"]);
        for (const x of [0.62, 1.3]) {
          poly(
            [
              point(x - 0.26, 0.7, 10),
              point(x + 0.26, 0.7, 10),
              point(x + 0.26, 1.25, 10),
              point(x - 0.26, 1.25, 10),
            ],
            "#0c151c",
          );
        }
      } else if (kind === "planter") {
        slab(0.12, 0.12, 1.76, 1.76, 0, 5, ["#665f51", "#393b32", "#4b5140"]);
        for (const x of [0.18, 1.3]) slab(x, 0.28, 0.45, 1.4, 5, 10, remains);
      } else {
        slab(0.18, 0.25, 1.6, 1.4, 0, 7, remains);
        slab(0.32, 0.4, 1.1, 0.8, 7, 12, remains);
        for (const x of [0.3, 0.85, 1.4]) slab(x, 0.4, 0.18, 1.2, 12, 14, remains);
      }
      for (let i = 0; i < 5; i++) {
        const x = 0.15 + (i % 3) * 0.52,
          y = 0.15 + Math.floor(i / 3) * 1.1;
        poly(
          [point(x, y, 15), point(x + 0.3, y + 0.05, 15), point(x + 0.16, y + 0.3, 15)],
          "#171f24",
          "#333b3c",
        );
      }
      texture.refresh();
      continue;
    }
    const metal = nightclub
        ? ["#3d444b", "#222b35", "#687079"]
        : office
          ? ["#56605c", "#323f40", "#8c9387"]
          : ["#4f626a", "#283c48", "#73878a"],
      wood = nightclub
        ? ["#644437", "#392d2b", "#96735a"]
        : office
          ? ["#795c42", "#4e3c30", "#b18d62"]
          : ["#766656", "#493f39", "#ac9270"],
      velvet = nightclub
        ? ["#62364d", "#342638", "#8a536d"]
        : office
          ? ["#486359", "#2d423e", "#6e8775"]
          : ["#624052", "#38293e", "#a56883"];
    const carton = (
      x: number,
      y: number,
      w: number,
      d: number,
      z: number,
      h: number,
      shade = wood,
    ) => {
      slab(x, y, w, d, z, z + h, shade);
      // Packing tape on the lid, shipping labels on both visible orientations.
      poly(
        [
          point(x + w * 0.43, y, z + h + 0.1),
          point(x + w * 0.55, y, z + h + 0.1),
          point(x + w * 0.55, y + d, z + h + 0.1),
          point(x + w * 0.43, y + d, z + h + 0.1),
        ],
        "#ac9970",
        "transparent",
      );
      const label = (side: "x" | "y", lo: number, hi: number) => {
        const at = (t: number, height: number) =>
          side === "x" ? point(x + t, y - 0.005, height) : point(x + w + 0.005, y + t, height);
        poly(
          [at(lo, z + h * 0.35), at(hi, z + h * 0.35), at(hi, z + h * 0.7), at(lo, z + h * 0.7)],
          "#c4bea2",
          "transparent",
        );
        for (let i = 0; i < 4; i++) {
          const a = at(lo + (hi - lo) * (0.15 + i * 0.17), z + h * 0.41),
            b = at(lo + (hi - lo) * (0.15 + i * 0.17), z + h * 0.63);
          ctx.strokeStyle = "#515548";
          ctx.lineWidth = 0.65;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      };
      label("x", w * 0.2, w * 0.53);
      label("y", d * 0.25, d * 0.63);
    };
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
        poly(
          [point(1.45, 0.32, 46), point(2, 0.32, 83), point(2, 1.68, 83), point(1.45, 1.68, 46)],
          "#28434b",
          "#a38c62",
        );
        poly([point(1.45, 0.2, 46), point(2, 0.2, 46), point(2, 0.32, 83)], body[0]!);
        if (rotation === 90)
          poly([point(1.45, 1.68, 46), point(2, 1.68, 83), point(2, 1.8, 46)], body[1]!);
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
          slab(
            0.18 + i * 0.35,
            0.55,
            0.16,
            0.2,
            z,
            z + (nightclub ? 10 + (i % 3) * 2 : 13),
            nightclub && i % 2
              ? ["#927249", "#584731", "#c9a36a"]
              : ["#43837c", "#275554", "#78aaa1"],
          );
      }
    } else if (kind === "lounge-table") {
      slab(0.8, 0.8, 0.4, 0.4, 0, 24, metal);
      slab(0.15, 0.15, 1.7, 1.7, 24, 29, wood);
      for (const x of [0.5, 1.3]) slab(x, 0.8, 0.13, 0.15, 29, 36, metal);
    } else if (kind === "stock") {
      for (let i = 0; i < 4; i++) {
        const x = 0.15 + (i % 2) * 0.85,
          y = 0.15 + Math.floor(i / 2) * 0.85;
        if (materials) carton(x, y, 0.75, 0.75, 0, 20 + (i % 3) * 10);
        else slab(x, y, 0.75, 0.75, 0, 20 + (i % 3) * 10, wood);
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
      if (office) {
        deskSlab(0.68, 1.545, 0.64, 0.012, 43, 56, ["#233e47", "#233e47", "#233e47"]);
        for (const z of [46, 50, 54])
          deskSlab(0.72, 1.53, z === 50 ? 0.31 : 0.5, 0.008, z, z + 0.8, [
            "#7ca4a4",
            "#7ca4a4",
            "#7ca4a4",
          ]);
      }
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
      if (materials) {
        const upright = ["#526c70", "#2f474e", "#8f9e94"];
        const beam = ["#997344", "#664a32", "#b89864"];
        // Back uprights first; near uprights last, so boxes cannot erase them.
        const posts = [
          [0.1, 1.6],
          [1.8, 1.6],
          [0.1, 0.2],
          [1.8, 0.2],
        ];
        const near = ([x, y]: number[]) => (rotation === 0 ? y! < 1 || x! > 1 : y! < 1 || x! < 1);
        for (const p of posts.filter((p) => !near(p)))
          slab(p[0]!, p[1]!, 0.09, 0.09, 0, 94, upright);
        for (const [level, z] of [12, 45, 78].entries()) {
          slab(0.1, 0.2, 1.8, 1.5, z, z + 3, beam);
          if (level === 1) {
            for (let i = 0; i < 3; i++) {
              const x = 0.24 + i * 0.51;
              slab(x, 0.48, 0.43, 0.88, z + 3, z + 18, ["#4d7776", "#315357", "#74918b"]);
              slab(x + 0.07, 0.475, 0.24, 0.025, z + 8, z + 12, ["#b3b49a", "#8a937f", "#b3b49a"]);
            }
          } else {
            carton(0.23, 0.39, 0.69, 1.08, z + 3, level === 0 ? 25 : 19);
            carton(1.02, 0.59, 0.64, 0.8, z + 3, level === 0 ? 18 : 14, [
              "#82735b",
              "#594f40",
              "#a89572",
            ]);
            if (level === 2) carton(1.08, 0.62, 0.48, 0.68, z + 17, 6);
          }
          // Beam and small bin label sit in front of the goods.
          slab(0.13, 0.19, 1.74, 0.055, z, z + 3, beam);
          slab(0.74, 0.185, 0.32, 0.009, z + 0.2, z + 2.6, ["#ccc4a0", "#ccc4a0", "#ccc4a0"]);
        }
        for (const p of posts.filter(near)) {
          slab(p[0]!, p[1]!, 0.09, 0.09, 0, 94, upright);
          slab(p[0]! - 0.02, p[1]! - 0.02, 0.14, 0.14, 0, 3, metal);
          for (let z = 18; z < 94; z += 13) {
            const a = point(p[0]! + 0.045, p[1]! - 0.008, z);
            ctx.fillStyle = "#182c32";
            ctx.fillRect(a.x - 0.5, a.y - 1, 1, 2);
          }
        }
      } else {
        for (const x of [0.1, 1.8]) for (const y of [0.2, 1.6]) slab(x, y, 0.1, 0.1, 0, 94, metal);
        for (const z of [12, 45, 78]) {
          slab(0.1, 0.2, 1.8, 1.5, z, z + 3, metal);
          for (let i = 0; i < 2; i++) slab(0.25 + i * 0.8, 0.45, 0.6, 1, z + 3, z + 23, wood);
        }
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
      for (const x of [0.18, width - 0.1])
        for (const y of [0.3, 1.5]) seatSlab(x, y, 0.09, 0.1, 0, 17, metal);
      seatSlab(0.1, 0.2, width, 1.5, 14, 21, metal);
      const cushions = waiting ? 1 : 2;
      const cushionWidth = (width - 0.34) / cushions;
      for (let i = 0; i < cushions; i++) {
        const x = 0.27 + i * cushionWidth;
        seatSlab(x, 0.25, cushionWidth - 0.035, 1.25, 21, 32, velvet);
        seatSlab(x, 1.53, cushionWidth - 0.035, 0.24, 30, 60, velvet);
        // Separate piping and a back seam stay readable without oversized wear.
        seatSlab(x + 0.025, 0.24, cushionWidth - 0.085, 0.025, 29, 30, metal);
      }
      for (const x of [0.13, width - 0.1]) seatSlab(x, 0.25, 0.16, 1.4, 22, 43, velvet);
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
        if (materials) {
          slab(1.2, 0.5, 0.5, 0.45, top, top + 12, ["#885640", "#503f36", "#b38458"]);
          slab(1.29, 0.59, 0.28, 0.23, top + 12, top + 14, metal);
          poly(
            [
              point(0.4, 1, top + 0.1),
              point(0.9, 1, top + 0.1),
              point(0.9, 1.35, top + 0.1),
              point(0.4, 1.35, top + 0.1),
            ],
            "#bcb798",
            "transparent",
          );
        }
      }
      if (kind === "bar") {
        // Timber ribs and a brass kick rail distinguish it from reception cabinetry.
        for (let i = 0; i < 8; i++) slab(0.12 + i * 0.24, 0.12, 0.075, 0.045, 9, 45, wood);
        slab(0.08, 0.08, 1.84, 0.08, 8, 11, ["#90734a", "#594a35", "#c0a375"]);
        for (let i = 0; i < 3; i++)
          slab(0.35 + i * 0.43, 1.3, 0.13, 0.15, top, top + 12, ["#43837c", "#275554", "#78aaa1"]);
        slab(1.42, 0.55, 0.32, 0.4, top, top + 2, metal);
      }
      if (kind === "reception") {
        slab(0.2, 0.11, 1.6, 0.025, 12, 43, wood);
        for (const x of [0.68, 1.22]) slab(x, 0.095, 0.015, 0.02, 12, 43, metal);
        slab(0.2, 0.08, 1.6, 0.035, 9, 11, metal);
      }
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
        if (nightclub)
          for (let i = 0; i < 5; i++)
            slab(0.9, 0.45 + i * 0.13, 0.09, 0.05, top + 7, top + 8, [
              "#57a5aa",
              "#2d6d7d",
              i % 2 ? "#72bec5" : "#c570a3",
            ]);
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
      const car = kind.startsWith("sedan-");
      const surface = car
        ? kind === "sedan-cabin"
          ? 84
          : 47
        : kind === "conference-table"
          ? 41
          : kind.includes("seat")
            ? 33
            : 40;
      poly(
        [
          point(0.25, 0.55, surface),
          point(0.85, 0.65, surface),
          point(1.25, 1.2, surface),
          point(0.6, 1.35, surface),
        ],
        "#25292b",
        "#786b56",
      );
      ctx.strokeStyle = "#c0a987";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const [i, p] of [
        point(0.25, 0.55, surface + 1),
        point(0.75, 0.8, surface + 1),
        point(0.65, 1.15, surface + 1),
        point(1.2, 1.35, surface + 1),
      ].entries()) {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      if (car && kind === "sedan-cabin") {
        poly(
          [point(0.1, 0.3, 54), point(0.55, 0.3, 76), point(0.95, 0.3, 55)],
          "#121f27",
          "#819393",
        );
      }
    }
    texture.refresh();
  }
}
