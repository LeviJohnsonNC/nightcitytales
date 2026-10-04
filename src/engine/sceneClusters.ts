/** Shared cluster placement for exterior and interior recipes. */
import type { Arena, Point, Rect } from "./battlefield";
import { blockedTiles, tileOf, tileKey } from "./grid";
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
    label?: string;
    art: EnvironmentArt[];
  }[];
  dressing: { kind: SceneEnvironment["dressing"][number]["kind"]; x: number; y: number }[];
};
/** Offsets describe relationships inside a cluster, never arbitrary world positions. */
export const CLUSTERS: Record<string, ClusterDefinition> = {
  work_facing: {
    zones: ["workspace"],
    reason: "Opposed desks share a side filing cabinet, with access at both seating sides",
    members: [
      { key: "office_desk", id: "near", x: 0, y: 0, art: ["desk"] },
      { key: "office_desk", id: "far", x: 0, y: 2, art: ["desk-reverse"] },
      { key: "office_storage", id: "filing", x: 2, y: 2, art: ["cabinet"] },
    ],
    dressing: [],
    access: [
      { x: 1, y: -1, label: "Pod seating approach" },
      { x: 1, y: 5, label: "Pod seating approach" },
      { x: 3, y: 1, label: "Shared filing access" },
    ],
  },
  work_island: {
    zones: ["workspace"],
    reason: "Four opposed workstations form an island with shared filing at its end",
    members: [
      { key: "office_desk", id: "near_left", x: 0, y: 0, art: ["desk"] },
      { key: "office_desk", id: "near_right", x: 2, y: 0, art: ["desk"] },
      { key: "office_desk", id: "far_left", x: 0, y: 2, art: ["desk-reverse"] },
      { key: "office_desk", id: "far_right", x: 2, y: 2, art: ["desk-reverse"] },
      { key: "office_storage", id: "filing", x: 4, y: 2, art: ["cabinet"] },
    ],
    dressing: [],
    access: [
      { x: 1, y: -1, label: "Pod seating approach" },
      { x: 3, y: -1, label: "Pod seating approach" },
      { x: 1, y: 5, label: "Pod seating approach" },
      { x: 3, y: 5, label: "Pod seating approach" },
      { x: 5, y: 1, label: "Shared filing access" },
    ],
  },
  reception_arrival: {
    zones: ["reception"],
    reason:
      "A staffed counter separates the visitor approach from staff access, beside a waiting group",
    members: [
      {
        key: "reception_counter",
        id: "counter",
        x: 4,
        y: 0,
        rotation: 90,
        art: ["reception", "reception"],
      },
    ],
    dressing: [],
    access: [
      { x: 7, y: 1, label: "Reception staff aisle" },
      { x: 7, y: 3, label: "Reception staff aisle" },
      { x: 3, y: 1, label: "Visitor approach" },
      { x: 3, y: 3, label: "Visitor approach" },
      { x: 1, y: 3, label: "Waiting seat approach" },
      { x: 5, y: 5, label: "Office transition" },
    ],
  },
  waiting_arrival: {
    zones: ["reception"],
    reason: "Waiting seating and its side table face the arrival landing",
    members: [{ key: "lounge_seat", id: "seat", x: 0, y: 0, art: ["waiting-seat"] }],
    dressing: [],
    access: [{ x: 1, y: -1, label: "Waiting seat approach" }],
  },
  waiting_entry: {
    zones: ["reception"],
    reason: "Waiting seating faces the entrance with a small side table",
    members: [{ key: "lounge_seat", id: "seat", x: 0, y: 0, art: ["waiting-seat-reverse"] }],
    dressing: [],
    access: [{ x: 1, y: 3, label: "Waiting seat approach" }],
  },
  equipment_support: {
    zones: ["service"],
    reason: "Equipment and maintenance supplies face one clear service aisle",
    members: [
      { key: "server_rack", id: "server", x: 0, y: 0, art: ["server"] },
      { key: "office_storage", id: "maintenance", x: 2, y: 0, art: ["cabinet"] },
    ],
    dressing: [],
    access: [
      { x: 1, y: 3, label: "Equipment maintenance" },
      { x: 3, y: 3, label: "Maintenance supply access" },
    ],
  },
  residential_entry: {
    zones: ["sidewalk", "frontage"],
    reason: "Apartment mailboxes identify the residential entrance beside a quiet planted approach",
    members: [
      {
        key: "office_storage",
        id: "mailboxes",
        label: "apartment mailbox bank",
        x: 0,
        y: -4,
        art: ["mailboxes"],
      },
      { key: "planter", id: "south", x: 0, y: 2, art: ["planter"] },
    ],
    dressing: [{ kind: "lamp", x: 0.3, y: -1.5 }],
    access: [{ x: 1, y: 1, label: "Residential entrance" }],
  },
  frontage_waiting: {
    zones: ["sidewalk", "frontage"],
    reason:
      "A merchandise display identifies the low commercial frontage beside its entrance, away from through traffic",
    members: [
      {
        key: "office_storage",
        id: "display",
        label: "shop merchandise display",
        x: 0,
        y: 0,
        art: ["shop-display"],
      },
      { key: "planter", id: "edge", x: 2, y: 0, art: ["planter"] },
    ],
    dressing: [],
    access: [{ x: 1, y: 3, label: "Merchandise browsing approach" }],
  },
  work_pod: {
    zones: ["workspace"],
    reason: "Two workstations share local filing and a continuous working aisle",
    members: [
      { key: "office_desk", id: "desk_left", x: 0, y: 0, art: ["desk"] },
      { key: "office_desk", id: "desk_right", x: 2, y: 0, art: ["desk"] },
      { key: "office_storage", id: "filing", x: 4, y: 0, art: ["cabinet"] },
    ],
    dressing: [],
    access: [
      { x: 1, y: 3, label: "Work pod seating aisle" },
      { x: 3, y: 3, label: "Work pod seating aisle" },
      { x: 5, y: 3, label: "Shared filing access" },
    ],
  },
  meeting_support: {
    zones: ["meeting"],
    reason: "Conference table and adjacent meeting storage share clear seating approaches",
    members: [
      {
        key: "meeting_table",
        id: "table",
        x: 0,
        y: 0,
        art: ["conference-table", "conference-table"],
      },
      { key: "office_storage", id: "cabinet", x: 6, y: 0, rotation: 90, art: ["cabinet"] },
    ],
    dressing: [],
    access: [
      { x: 1, y: -1, label: "Meeting seating access" },
      { x: 3, y: 3, label: "Meeting seating access" },
      { x: 5, y: 1, label: "Perimeter credenza access" },
    ],
  },
  vendor_stall: {
    zones: ["sidewalk"],
    reason:
      "A shopfront food cart keeps its stock behind it and customer space beside the public route",
    members: [
      { key: "food_cart", id: "cart", x: 0, y: 0, art: ["food-cart"] },
      { key: "freight_crate", id: "stock", x: 0, y: -2, art: ["cargo"] },
    ],
    dressing: [
      { kind: "sign", x: 0.4, y: 2.7 },
      { kind: "litter", x: 0.6, y: 3.2 },
    ],
    access: [{ x: 1, y: 3, label: "Food stall customer space" }],
  },
  workshop_delivery: {
    zones: ["loading"],
    reason: "Delivered stock lines the workshop wall beside a reserved handling aisle",
    members: [
      { key: "freight_crate", id: "crate", x: 0, y: 0, art: ["cargo"] },
      { key: "freight_pallet", id: "pallet", x: 0, y: 4, art: ["pallet"] },
    ],
    dressing: [{ kind: "sign", x: 0.3, y: 2.6 }],
    access: [
      { x: 3, y: 1, label: "Workshop freight handling" },
      { x: 3, y: 3, label: "Workshop freight handling" },
      { x: 3, y: 5, label: "Workshop freight handling" },
    ],
  },
  workshop_service: {
    zones: ["loading"],
    reason: "Waste collection and power equipment share a workshop maintenance aisle",
    members: [
      { key: "service_dumpster", id: "bin", x: 0, y: 0, art: ["dumpster"] },
      { key: "service_generator", id: "power", x: 0, y: 4, art: ["generator"] },
    ],
    dressing: [{ kind: "sign", x: 0.3, y: 2.6 }],
    access: [
      { x: 3, y: 1, label: "Workshop maintenance access" },
      { x: 3, y: 3, label: "Workshop maintenance access" },
      { x: 3, y: 5, label: "Workshop maintenance access" },
    ],
  },
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
    zones: ["garden", "frontage", "sidewalk", "reception", "workspace", "meeting", "seating"],
    reason: "Low planters belong to a residential frontage, clear of the front door",
    members: [{ key: "planter", id: "planter", x: 0, y: 0, art: ["planter"] }],
    dressing: [],
  },
  storage_cabinet: {
    zones: ["workspace", "meeting", "service", "performance"],
    reason: "Local equipment storage faces a clear working aisle",
    members: [{ key: "office_storage", id: "cabinet", x: 0, y: 0, art: ["cabinet"] }],
    dressing: [],
    access: [{ x: 1, y: 3, label: "Cabinet access" }],
  },
  supplies: {
    zones: ["service", "loading", "frontage"],
    reason: "Stock is grouped beside service activity with handling space",
    members: [{ key: "freight_crate", id: "stock", x: 0, y: 0, art: ["cargo"] }],
    dressing: [{ kind: "supplies", x: 2.4, y: 0.5 }],
    access: [{ x: 1, y: 3, label: "Stock access" }],
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
      {
        key: "meeting_table",
        id: "table",
        x: 0,
        y: 0,
        art: ["conference-table", "conference-table"],
      },
    ],
    dressing: [],
    access: [
      { x: 1, y: -1, label: "Meeting seating access" },
      { x: 3, y: 3, label: "Meeting seating access" },
    ],
  },
  seating: {
    zones: ["seating", "reception", "meeting"],
    reason: "Booth seating faces clear customer space",
    members: [{ key: "lounge_seat", id: "seat", x: 0, y: 0, art: ["seat"] }],
    dressing: [],
    access: [{ x: 1, y: 3, label: "Seat approach" }],
  },
  booth: {
    zones: ["seating", "reception"],
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
  bar_service: {
    zones: ["service"],
    reason: "Continuous customer counter faces a backbar across a protected staff aisle",
    members: [
      { key: "bar_counter", id: "counter", x: 0, y: 0, art: ["bar", "bar"] },
      {
        key: "office_storage",
        id: "back_left",
        label: "backbar bottle storage",
        x: 0,
        y: 4,
        art: ["backbar"],
      },
      {
        key: "office_storage",
        id: "back_right",
        label: "backbar bottle storage",
        x: 2,
        y: 4,
        art: ["backbar"],
      },
    ],
    dressing: [],
    access: [
      { x: 1, y: -1, label: "Bar customer approach" },
      { x: 3, y: -1, label: "Bar customer approach" },
      { x: 1, y: 3, label: "Backbar staff aisle" },
      { x: 3, y: 3, label: "Backbar staff aisle" },
      { x: -1, y: 1, label: "Staff access around counter end" },
    ],
  },
  lounge_bench: {
    zones: ["seating"],
    reason: "Joined lounge seating faces paired low tables beside a shared approach",
    members: [
      { key: "lounge_seat", id: "left", x: 0, y: 2, art: ["seat"] },
      { key: "lounge_seat", id: "right", x: 2, y: 2, art: ["seat"] },
      { key: "cafe_table", id: "table_left", x: 0, y: 0, art: ["lounge-table"] },
      { key: "cafe_table", id: "table_right", x: 2, y: 0, art: ["lounge-table"] },
    ],
    dressing: [],
    access: [
      { x: 5, y: 1, label: "Lounge table approach" },
      { x: 5, y: 3, label: "Lounge seat approach" },
    ],
  },
  lounge_conversation: {
    zones: ["seating"],
    reason: "Opposed lounge seats share a low table and a clear side aisle",
    members: [
      { key: "lounge_seat", id: "near", x: 0, y: 0, art: ["seat-reverse"] },
      { key: "cafe_table", id: "table", x: 0, y: 2, art: ["lounge-table"] },
      { key: "lounge_seat", id: "far", x: 0, y: 4, art: ["seat"] },
    ],
    dressing: [],
    access: [
      { x: 3, y: 1, label: "Lounge seat approach" },
      { x: 3, y: 3, label: "Shared table approach" },
      { x: 3, y: 5, label: "Lounge seat approach" },
    ],
  },
  service_stock: {
    zones: ["service"],
    reason: "Restocking shelf and supplies share an open handling aisle",
    members: [
      {
        key: "office_storage",
        id: "shelf",
        label: "restocking shelf",
        x: 0,
        y: 0,
        art: ["backbar"],
      },
      { key: "freight_crate", id: "stock", label: "beverage stock", x: 2, y: 0, art: ["stock"] },
    ],
    dressing: [],
    access: [
      { x: 1, y: -1, label: "Restocking shelf approach" },
      { x: 3, y: -1, label: "Stock handling approach" },
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
  speakers: {
    zones: ["performance"],
    reason: "Sound equipment flanks the floor-level performance area",
    members: [{ key: "audio_stack", id: "speaker", x: 0, y: 0, art: ["speaker"] }],
    dressing: [],
    access: [{ x: 1, y: 3, label: "Audio equipment access" }],
  },
  performance: {
    zones: ["performance"],
    reason: "Floor-level DJ console with an accessible operator position",
    members: [{ key: "dj_console", id: "console", x: 0, y: 0, art: ["dj"] }],
    dressing: [],
    access: [{ x: 1, y: 3, label: "DJ working space" }],
  },
  parking: {
    zones: ["road", "parking"],
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
  axis?: "x" | "y";
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
    const axis = slot.axis ?? z.axis;
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
    const tryPlacement = (at: Point) => {
      const entries = variant.members.flatMap((m) => {
        const prop = battlefieldProp(m.key);
        if (!prop) throw new Error(`Missing composition prop ${m.key}`);
        const rotation = axis === "x" ? (m.rotation === 90 ? 0 : 90) : (m.rotation ?? 0);
        const memberAt = {
          x: at.x + (axis === "x" ? m.y : m.x),
          y: at.y + (axis === "x" ? m.x : m.y),
        };
        return placeProp(prop, memberAt, `${slot.id}_${m.id}`, rotation).map((piece, i) => ({
          piece: {
            ...piece,
            label: slot.label
              ? `${slot.label} · ${m.label ?? piece.label}`
              : (m.label ?? piece.label),
          },
          art: env.interior && slot.kind === "supplies" ? ("stock" as const) : m.art[i]!,
          rotation,
        }));
      });
      const access = (variant.access ?? []).map((a) => ({
        position: {
          x: at.x + (axis === "x" ? a.y : a.x),
          y: at.y + (axis === "x" ? a.x : a.y),
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
      let legal =
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
      // Furniture may share working aisles, but must never seal a floor pocket.
      // Reject a candidate before committing cover or access anchors.
      if (legal && entries.length) {
        const candidate = { ...arena, cover: [...arena.cover!, ...entries.map((e) => e.piece)] };
        const blocked = blockedTiles(candidate, {});
        const origin = tileOf(candidate, candidate.playerStart);
        const seen = new Set([tileKey(origin)]);
        const queue = [origin];
        const cols = arena.extent.width / 2,
          rows = arena.extent.height / 2;
        for (let i = 0; i < queue.length; i++) {
          const tile = queue[i]!;
          for (const [dc, dr] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const next = { col: tile.col + dc!, row: tile.row + dr! };
            const key = tileKey(next);
            if (
              next.col >= 0 &&
              next.row >= 0 &&
              next.col < cols &&
              next.row < rows &&
              !blocked.has(key) &&
              !seen.has(key)
            ) {
              seen.add(key);
              queue.push(next);
            }
          }
        }
        legal = env.interior
          ? seen.size + blocked.size === cols * rows
          : reserved.every((r) =>
              seen.has(tileKey(tileOf(candidate, { x: r.x + r.width / 2, y: r.y + r.height / 2 }))),
            );
      }
      return { at, entries, access, legal };
    };
    let placement: ReturnType<typeof tryPlacement> | undefined;
    for (const at of slot.candidates ?? [slot.at]) {
      const candidate = tryPlacement(at);
      if (candidate.legal) {
        placement = candidate;
        break;
      }
    }
    if (!placement) {
      if (slot.required) throw new Error(`Required cluster cannot fit: ${slot.id}`);
      continue;
    }
    const { at, entries, access } = placement;
    for (const [i, a] of access.entries()) {
      reserved.push(rect(a.position.x - 1, a.position.y - 1, 2, 2));
      if (env.interior) {
        env.interior.access.push({ id: `${slot.id}_access_${i}`, zoneId: z.id, ...a });
      } else {
        // Outdoor working space must survive save/reload and later context
        // substitutions, just as indoor access anchors do.
        env.zones.push({
          id: `${slot.id}_access_${i}`,
          kind: "aisle",
          rect: rect(a.position.x - 1, a.position.y - 1, 2, 2),
          axis,
        });
      }
    }
    env.clusters.push({ id: slot.id, kind: variantKind, zoneId: z.id, reason: variant.reason });
    for (const { piece, art, rotation } of entries) {
      arena.cover!.push(piece);
      env.props.push({ coverId: piece.id, art, rotation, clusterId: slot.id });
    }
    for (const [i, d] of variant.dressing.entries()) {
      const position = {
        x: at.x + (axis === "x" ? d.y : d.x),
        y: at.y + (axis === "x" ? d.x : d.y),
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
