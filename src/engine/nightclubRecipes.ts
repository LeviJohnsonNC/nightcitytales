/** Arrival, performance and staff activity use the shared saved-zone/cluster solver. */
import type { SceneZone } from "./sceneEnvironment";
import type { Slot } from "./sceneClusters";

export function nightclubArrangements(variant: number) {
  const zones: SceneZone[] = [];
  const slots: Slot[] = [];
  const floor = (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    floorUse?: SceneZone["floorUse"],
  ) =>
    zones.push({
      id,
      kind: "aisle",
      rect: { x, y, width, height },
      axis: "y",
      ...(floorUse ? { floorUse } : {}),
    });
  const checkin = (x: number, y: number) => {
    slots.push({
      id: "club_admission",
      kind: "club_checkin",
      zone: "reception",
      axis: "y",
      at: { x, y },
      required: true,
    });
    floor("admission_visitor", x, y, 2, 2, "visitor");
    floor("admission_staff", x + 4, y, 2, 2, "staff");
  };
  if (variant === 0) {
    floor("arrival_landing", 2, 4, 4, 2, "entry");
    floor("public_foyer", 2, 4, 28, 2);
    checkin(6, 2);
  } else if (variant === 1) {
    floor("arrival_landing", 2, 4, 4, 2, "entry");
    floor("public_foyer", 2, 6, 2, 6);
    floor("public_floor_approach", 2, 10, 8, 2);
    checkin(2, 8);
    // Only the larger back room has a separate preparation station. Compact
    // service rooms retain their accepted stock/handling group without infill.
    slots.push({
      id: "club_preparation",
      kind: "club_prep",
      zone: "service",
      axis: "y",
      at: { x: 2, y: 22 },
      required: true,
    });
    floor("preparation_working", 2, 24, 4, 2, "staff");
    floor("preparation_storage", 4, 26, 2, 2, "staff");
  } else {
    floor("arrival_landing", 2, 22, 4, 2, "entry");
    floor("public_foyer", 2, 24, 2, 4);
    floor("public_hall_approach", 6, 20, 2, 4);
    checkin(4, 24);
  }
  const [x, y] = variant === 0 ? [12, 8] : variant === 1 ? [14, 2] : [26, 4];
  const axis = variant === 2 ? "x" : "y";
  slots.push({
    id: "club_performance",
    kind: "dj_control",
    zone: "performance",
    axis,
    at: { x: x!, y: y! },
    required: true,
  });
  floor("dj_operator", x! + (axis === "x" ? 0 : 2), y! + (axis === "x" ? 2 : 0), 2, 2, "staff");
  return { zones, slots };
}
