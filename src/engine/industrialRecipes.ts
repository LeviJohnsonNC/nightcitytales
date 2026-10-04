/** Distinct industrial organizations expressed in the same room/connection vocabulary. */
import type { Slot } from "./sceneClusters";
import type { InteriorPlan } from "./interiorRecipes";
import type { SceneZone, ZoneKind } from "./sceneEnvironment";
const zone = (
  id: string,
  kind: ZoneKind,
  x: number,
  y: number,
  width: number,
  height: number,
): SceneZone => ({ id, kind, rect: { x, y, width, height }, axis: "y" });
export function industrialPlan(kind: "warehouse" | "garage", variant: number): InteriorPlan {
  if (kind === "warehouse") {
    if (variant === 0)
      return {
        label: "Receiving and rack hall",
        rooms: [
          zone("reception", "reception", 2, 2, 8, 8),
          zone("service", "service", 2, 12, 8, 18),
          zone("work", "storage", 12, 2, 18, 18),
          zone("staging", "staging", 12, 22, 18, 8),
        ],
        doors: [
          ["reception", "work", 10, 4],
          ["reception", "service", 4, 10],
          ["service", "work", 10, 16],
          ["work", "staging", 12, 20, 18, 2],
          ["staging", "outside", 18, 30, 8, 2],
        ],
      };
    if (variant === 1)
      return {
        label: "Side office and loading apron",
        rooms: [
          zone("work", "storage", 2, 2, 18, 20),
          zone("staging", "staging", 2, 24, 18, 6),
          zone("reception", "reception", 22, 2, 8, 10),
          zone("service", "service", 22, 14, 8, 16),
        ],
        doors: [
          ["reception", "work", 20, 6],
          ["reception", "service", 26, 12],
          ["service", "work", 20, 18],
          ["work", "staging", 2, 22, 18, 2],
          ["staging", "outside", 6, 30, 8, 2],
        ],
      };
    return {
      label: "Cross aisle stockrooms",
      rooms: [
        zone("hall", "corridor", 2, 14, 28, 4),
        zone("work", "storage", 2, 2, 12, 10),
        zone("stock", "storage", 16, 2, 14, 10),
        zone("staging", "staging", 2, 20, 12, 10),
        zone("reception", "reception", 16, 20, 6, 10),
        zone("service", "service", 24, 20, 6, 10),
      ],
      doors: [
        ["work", "hall", 4, 12, 8, 2],
        ["stock", "hall", 18, 12, 8, 2],
        ["staging", "hall", 4, 18, 8, 2],
        ["reception", "hall", 18, 18],
        ["service", "hall", 26, 18],
        ["staging", "outside", 4, 30, 8, 2],
      ],
    };
  }
  if (variant === 0)
    return {
      label: "Workshop and shared vehicle bay",
      rooms: [
        zone("reception", "reception", 2, 2, 8, 10),
        zone("service", "service", 2, 14, 8, 16),
        zone("work", "workbay", 12, 2, 18, 20),
        zone("staging", "staging", 12, 24, 18, 6),
      ],
      doors: [
        ["reception", "service", 6, 12],
        ["reception", "work", 10, 6],
        ["service", "work", 10, 18],
        ["work", "staging", 12, 22, 18, 2],
        ["staging", "outside", 18, 30, 8, 2],
      ],
    };
  if (variant === 1)
    return {
      label: "Two vehicle halls",
      rooms: [
        zone("work", "workbay", 2, 2, 12, 28),
        zone("secondary", "workbay", 16, 2, 14, 16),
        zone("reception", "reception", 16, 20, 6, 10),
        zone("service", "service", 24, 20, 6, 10),
      ],
      doors: [
        ["work", "secondary", 14, 4, 2, 10],
        ["work", "reception", 14, 24],
        ["secondary", "reception", 18, 18],
        ["secondary", "service", 26, 18],
        ["work", "outside", 0, 20, 2, 8],
      ],
    };
  return {
    label: "Street-facing service bays",
    rooms: [
      zone("reception", "reception", 2, 2, 10, 8),
      zone("service", "service", 14, 2, 16, 8),
      zone("work", "workbay", 2, 12, 28, 18),
    ],
    doors: [
      ["reception", "work", 4, 10, 6, 2],
      ["service", "work", 20, 10, 8, 2],
      ["work", "outside", 12, 30, 8, 2],
    ],
  };
}

/** Functional arrangements are authored beside the floorplan, before any props.
 * Saved aisles protect freight/vehicle movement from every later placement pass. */
export function industrialArrangements(kind: "warehouse" | "garage", variant: number) {
  const zones: SceneZone[] = [];
  const slots: Slot[] = [];
  const route = (
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    use: "handling" | "staff" = "handling",
  ) => zones.push({ ...zone(id, "aisle", x, y, w, h), floorUse: use });
  const group = (id: string, family: string, room: string, x: number, y: number) =>
    slots.push({ id, kind: family, zone: room, at: { x, y }, axis: "y", required: true });
  const racks = (room: string, positions: [number, number][]) =>
    positions.forEach(([x, y], i) => {
      group(`${room}_rack_${i}`, "rack_aisle", room, x, y);
      route(`${room}_picking_${i}`, x, y + 2, 4, 2, "staff");
    });
  const bay = (id: string, room: string, x: number, y: number) => {
    group(id, "service_bay", room, x, y);
    route(`${id}_tools`, x, y + 2, 6, 2, "staff");
    route(`${id}_left`, x, y + 4, 2, 4, "staff");
    route(`${id}_right`, x + 4, y + 4, 2, 4, "staff");
  };
  if (kind === "warehouse") {
    if (variant === 0) {
      route("freight_spine", 20, 2, 4, 28);
      route("receiving_apron", 18, 26, 8, 4);
      racks("work", [
        [14, 4],
        [26, 4],
        [14, 12],
        [26, 12],
      ]);
      group("receiving_stock", "freight", "staging", 14, 24);
      group("outbound_stock", "freight", "staging", 26, 24);
    } else if (variant === 1) {
      route("freight_spine", 8, 2, 4, 28);
      route("receiving_apron", 6, 28, 8, 2);
      racks("work", [
        [2, 4],
        [14, 4],
        [2, 14],
        [14, 14],
      ]);
      group("receiving_stock", "freight", "staging", 2, 26);
      group("outbound_stock", "freight", "staging", 16, 26);
    } else {
      route("freight_spine", 6, 20, 4, 10);
      route("receiving_apron", 4, 28, 8, 2);
      racks("work", [[4, 4]]);
      racks("stock", [
        [18, 4],
        [24, 4],
      ]);
      group("receiving_stock", "freight", "staging", 2, 22);
    }
  } else if (variant === 0) {
    route("vehicle_spine", 20, 12, 4, 18);
    route("bay_approach", 12, 12, 18, 4);
    route("vehicle_apron", 18, 26, 8, 4);
    bay("west_bay", "work", 12, 4);
    bay("east_bay", "work", 24, 4);
    // A clear manoeuvring/inspection area remains at the rear of the hall.
    route("inspection_space", 14, 18, 4, 4, "staff");
  } else if (variant === 1) {
    route("vehicle_spine", 10, 4, 4, 20);
    route("vehicle_apron", 2, 20, 12, 8);
    route("bay_approach", 16, 12, 14, 4);
    bay("main_bay", "work", 4, 6);
    bay("side_bay", "secondary", 20, 4);
  } else {
    route("vehicle_spine", 14, 12, 4, 18);
    route("bay_approach", 2, 26, 28, 4);
    bay("west_bay", "work", 4, 18);
    bay("east_bay", "work", 22, 18);
  }
  return { zones, slots };
}
