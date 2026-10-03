import type { combatantDisposition } from "@/engine";

export function dispositionLabel(disposition: ReturnType<typeof combatantDisposition>) {
  return disposition === "withdrawn"
    ? "Withdrew"
    : disposition === "dead"
      ? "Dead"
      : disposition === "out_of_fight"
        ? "Out of fight"
        : "Present";
}
