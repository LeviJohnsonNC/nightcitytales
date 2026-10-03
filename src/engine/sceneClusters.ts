/** Shared cluster placement for exterior and interior recipes. */
import type { Arena, Point, Rect } from "./battlefield";
import { battlefieldProp, placeProp } from "./battlefieldProps";
import {
  rectInside,
  rectsOverlap,
  type SceneEnvironment,
  type EnvironmentArt,
  type ZoneKind,
} from "./sceneEnvironment";
export type ClusterDefinition = {
  zones: ZoneKind[];
  reason: string;
  access?: { x: number; y: number; label: string }[];
  members: {
    key: string;
    id: string;
    x: number;
    y: number;
    rotation?: 0 | 90;
    art: EnvironmentArt[];
  }[];
  dressing: { kind: SceneEnvironment["dressing"][number]["kind"]; x: number; y: number }[];
};
/** Offsets describe relationships inside a cluster, never arbitrary world positions. */
export const CLUSTERS: Record<string, ClusterDefinition> = {
  racking: {
    zones: ["storage"],
    reason: "Stocked shelving forms regular rack aisles with picking access",
    members: [{ key: "steel_shelving", id: "rack", x: 0, y: 0, art: ["shelf", "shelf"] }],
    dressing: [],
    access: [
      { x: 1, y: 3, label: "Rack picking aisle" },
      { x: 3, y: 3, label: "Rack picking aisle" },
    ],
  },
  vehicle_bay: {
    zones: ["workbay"],
    reason: "Vehicles occupy service bays with front approach and side working space",
    members: [{ key: "sedan", id: "vehicle", x: 0, y: 0, art: ["sedan-engine", "sedan-cabin"] }],
    dressing: [],
    access: [
      { x: -1, y: 1, label: "Vehicle approach" },
      { x: 1, y: 3, label: "Engine working space" },
      { x: 3, y: 3, label: "Cabin working space" },
    ],
  },
  freight: {
    zones: ["staging"],
    reason: "Receiving freight stays beside loading access with clear handling space",
    members: [
      { key: "freight_crate", id: "crate", x: 0, y: 0, art: ["cargo"] },
      { key: "freight_pallet", id: "pallet", x: 2, y: 0, art: ["pallet"] },
    ],
    dressing: [],
    access: [{ x: 1, y: 3, label: "Freight handling space" }],
  },
  workbench: {
    zones: ["service"],
    reason: "Workshop cabinets face a usable working aisle",
    members: [{ key: "workbench", id: "bench", x: 0, y: 0, art: ["workbench", "workbench"] }],
    dressing: [],
    access: [
      { x: 1, y: 3, label: "Bench working aisle" },
      { x: 3, y: 3, label: "Bench working aisle" },
    ],
  },
  garden: {
    zones: ["garden", "frontage"],
    reason: "Low planters belong to a residential frontage, clear of the front door",
    members: [{ key: "planter", id: "planter", x: 0, y: 0, art: ["planter"] }],
    dressing: [],
  },
  driveway: {
    zones: ["driveway"],
    reason: "A resident's car follows the driveway with a clear approach",
    members: [
      { key: "sedan", id: "car", x: 0, y: 0, rotation: 90, art: ["sedan-engine", "sedan-cabin"] },
    ],
    dressing: [],
  },
  workstation: {
    zones: ["workspace"],
    reason: "Desk faces accessible working space inside a work area",
    members: [{ key: "office_desk", id: "desk", x: 0, y: 0, art: ["desk"] }],
    dressing: [],
    access: [{ x: 1, y: 3, label: "Desk working space" }],
  },
  reception: {
    zones: ["reception"],
    reason: "Reception counter separates visitor approach from staff space",
    members: [
      { key: "reception_counter", id: "counter", x: 0, y: 0, art: ["reception", "reception"] },
    ],
    dressing: [],
    access: [
      { x: 1, y: -1, label: "Reception staff access" },
      { x: 1, y: 3, label: "Visitor approach" },
    ],
  },
  meeting: {
    zones: ["meeting"],
    reason: "Meeting table has usable circulation on both sides",
    members: [
      { key: "meeting_table", id: "table", x: 0, y: 0, art: ["meeting-table", "meeting-table"] },
    ],
    dressing: [],
    access: [
      { x: 1, y: -1, label: "Meeting seating access" },
      { x: 3, y: 3, label: "Meeting seating access" },
    ],
  },
  seating: {
    zones: ["seating", "reception"],
    reason: "Booth seating faces clear customer space",
    members: [{ key: "lounge_seat", id: "seat", x: 0, y: 0, art: ["seat"] }],
    dressing: [],
    access: [{ x: 1, y: 3, label: "Seat approach" }],
  },
  booth: {
    zones: ["seating"],
    reason: "A lounge seat and low table share a clear customer approach",
    members: [
      { key: "lounge_seat", id: "seat", x: 0, y: 0, art: ["seat"] },
      { key: "cafe_table", id: "table", x: 2, y: 0, art: ["meeting-table"] },
    ],
    dressing: [],
    access: [
      { x: 1, y: 3, label: "Booth approach" },
      { x: 3, y: 3, label: "Table approach" },
    ],
  },
  bar: {
    zones: ["service"],
    reason: "Bar separates customer approach and staff working aisle",
    members: [{ key: "bar_counter", id: "counter", x: 0, y: 0, art: ["bar", "bar"] }],
    dressing: [],
    access: [
      { x: 1, y: -1, label: "Bar staff aisle" },
      { x: 3, y: 3, label: "Customer approach" },
    ],
  },
  server: {
    zones: ["service"],
    reason: "Equipment cabinet has a clear maintenance approach",
    members: [{ key: "server_rack", id: "cabinet", x: 0, y: 0, art: ["server"] }],
    dressing: [],
    access: [{ x: 1, y: 3, label: "Equipment service access" }],
  },
  performance: {
    zones: ["performance"],
    reason: "Floor-level DJ console with an accessible operator position",
    members: [{ key: "dj_console", id: "console", x: 0, y: 0, art: ["dj"] }],
    dressing: [],
    access: [{ x: 1, y: 3, label: "DJ working space" }],
  },
  parking: {
    zones: ["road"],
    reason: "Vehicles parked in the curb lane outside businesses",
    members: [
      { key: "sedan", id: "car", x: 0, y: 0, rotation: 90, art: ["sedan-engine", "sedan-cabin"] },
    ],
    dressing: [{ kind: "drain", x: 1.8, y: 4.6 }],
  },
  vendor: {
    zones: ["sidewalk"],
    reason: "Food service beside a shop with supplies and waiting space",
    members: [{ key: "food_cart", id: "cart", x: 0, y: 0, art: ["food-cart"] }],
    dressing: [
      { kind: "supplies", x: 0.5, y: -0.6 },
      { kind: "stools", x: 2.8, y: 0.7 },
      { kind: "sign", x: 0.4, y: 2.7 },
      { kind: "litter", x: 0.6, y: 3.2 },
    ],
  },
  service: {
    zones: ["loading", "frontage"],
    reason: "Waste and utilities beside a building's service entrance",
    members: [
      { key: "service_dumpster", id: "bin", x: 0, y: 0, art: ["dumpster"] },
      { key: "service_generator", id: "power", x: 0, y: 4, art: ["generator"] },
    ],
    dressing: [
      { kind: "litter", x: 2.7, y: 0.6 },
      { kind: "supplies", x: 2.6, y: 4.7 },
      { kind: "lamp", x: 0.3, y: 2.8 },
    ],
  },
  loading: {
    zones: ["loading", "frontage"],
    reason: "Delivered freight grouped beside a loading entrance",
    members: [
      { key: "freight_crate", id: "crate", x: 0, y: 0, art: ["cargo"] },
      { key: "freight_pallet", id: "pallet", x: 0, y: 4, art: ["pallet"] },
    ],
    dressing: [
      { kind: "supplies", x: 2.7, y: 1.2 },
      { kind: "litter", x: 2.5, y: 4.8 },
      { kind: "sign", x: 0.3, y: 2.6 },
    ],
  },
  frontage: {
    zones: ["sidewalk", "frontage", "loading"],
    reason: "Street furniture follows the building frontage, leaving the walking lane open",
    members: [],
    dressing: [
      { kind: "lamp", x: 0.4, y: 0.4 },
      { kind: "sign", x: 0.4, y: 2 },
      { kind: "litter", x: 0.7, y: 3.2 },
      { kind: "bollards", x: 1.3, y: 5.2 },
    ],
  },
};
export type Slot = {
  label?: string;
  id: string;
  kind: string;
  zone: string;
  at: Point;
  candidates?: Point[];
  required?: boolean;
};
const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});
export function placeSceneClusters(
  arena: Arena,
  slots: Slot[],
  reserved: Rect[],
  seed: number,
  varyService = true,
) {
  const env = arena.environment!;
  const crossings = env.zones
    .filter((z) =>
      ["crosswalk", "intersection", "corridor", "doorway", "dance", "aisle"].includes(z.kind),
    )
    .map((z) => z.rect);
  let randomState = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  for (const slot of slots) {
    const definition = CLUSTERS[slot.kind]!;
    const z = env.zones.find((z) => z.id === slot.zone)!;
    if (!definition.zones.includes(z.kind)) throw new Error(`Illegal cluster zone: ${slot.id}`);
    // Optional service clusters change contents; the required story facts always win.
    const variantKind =
      varyService && !slot.required && random() > 0.5 && ["service", "loading"].includes(slot.kind)
        ? slot.kind === "service"
          ? "loading"
          : "service"
        : slot.kind;
    const variant = CLUSTERS[variantKind]!;
    if (!variant.zones.includes(z.kind)) throw new Error(`Illegal variant zone: ${slot.id}`);
    const placement = (slot.candidates ?? [slot.at])
      .map((at) => {
        const entries = variant.members.flatMap((m) => {
          const prop = battlefieldProp(m.key);
          if (!prop) throw new Error(`Missing composition prop ${m.key}`);
          const rotation = z.axis === "x" ? (m.rotation === 90 ? 0 : 90) : (m.rotation ?? 0);
          const memberAt = {
            x: at.x + (z.axis === "x" ? m.y : m.x),
            y: at.y + (z.axis === "x" ? m.x : m.y),
          };
          return placeProp(prop, memberAt, `${slot.id}_${m.id}`, rotation).map((piece, i) => ({
            piece: slot.label ? { ...piece, label: `${slot.label} · ${piece.label}` } : piece,
            art: m.art[i]!,
            rotation,
          }));
        });
        const access = (variant.access ?? []).map((a) => ({
          position: {
            x: at.x + (z.axis === "x" ? a.y : a.x),
            y: at.y + (z.axis === "x" ? a.x : a.y),
          },
          label: a.label,
        }));
        const legalAccess = access.every((a) => {
          const tile = rect(a.position.x - 1, a.position.y - 1, 2, 2);
          return (
            rectInside(tile, z.rect) &&
            ![
              ...env.structures.map((s) => s.rect),
              ...arena.cover!.map((c) => c.rect),
              ...entries.map((e) => e.piece.rect),
            ].some((r) => rectsOverlap(r, tile))
          );
        });
        const legal =
          legalAccess &&
          entries.every(
            ({ piece }) =>
              rectInside(piece.rect, z.rect) &&
              rectInside(piece.rect, rect(0, 0, arena.extent.width, arena.extent.height)) &&
              ![
                ...reserved,
                ...crossings,
                ...env.structures.map((s) => s.rect),
                ...arena.cover!.map((c) => c.rect),
              ].some((r) => rectsOverlap(r, piece.rect)),
          );
        return { at, entries, access, legal };
      })
      .find((p) => p.legal);
    if (!placement) {
      if (slot.required) throw new Error(`Required cluster cannot fit: ${slot.id}`);
      continue;
    }
    const { at, entries, access } = placement;
    for (const [i, a] of access.entries()) {
      reserved.push(rect(a.position.x - 1, a.position.y - 1, 2, 2));
      env.interior?.access.push({ id: `${slot.id}_access_${i}`, zoneId: z.id, ...a });
    }
    env.clusters.push({ id: slot.id, kind: variantKind, zoneId: z.id, reason: variant.reason });
    for (const { piece, art, rotation } of entries) {
      arena.cover!.push(piece);
      env.props.push({ coverId: piece.id, art, rotation, clusterId: slot.id });
    }
    for (const [i, d] of variant.dressing.entries()) {
      const position = {
        x: at.x + (z.axis === "x" ? d.y : d.x),
        y: at.y + (z.axis === "x" ? d.x : d.y),
      };
      if (
        rectInside({ ...position, width: 0, height: 0 }, z.rect) &&
        ![...reserved, ...arena.cover!.map((c) => c.rect)].some(
          (r) =>
            position.x > r.x &&
            position.x < r.x + r.width &&
            position.y > r.y &&
            position.y < r.y + r.height,
        )
      )
        env.dressing.push({
          id: `${slot.id}_detail_${i}`,
          kind: d.kind,
          position,
          clusterId: slot.id,
        });
    }
  }
}
