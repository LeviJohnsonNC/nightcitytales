import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CombatDepartures } from "../CombatDepartures";
import { combatantDataOf } from "../encounterModel";
import type { EncounterCombatant } from "@/lib/backend";
import type { LiveEncounter } from "@/features/campaign/encounterState";

it.each(["morale", "goal_met"] as const)(
  "recovers a %s withdrawal explanation from saved combatant JSON",
  (exitCause) => {
    const data = combatantDataOf({
      data: { exitReason: "withdrawn", exitCause },
    } as unknown as EncounterCombatant);
    expect(data.exitCause).toBe(exitCause);
    const live = {
      state: { combatants: { h: { id: "h", name: "Lookout", defeated: true } } },
      data: { h: data },
    } as unknown as LiveEncounter;
    const html = renderToStaticMarkup(<CombatDepartures live={live} />);
    expect(html).toContain("Withdrew");
    expect(html).toContain(exitCause === "morale" ? "morale broke" : "objective met");
    expect(html).not.toContain("Dead");
  },
);
it("does not fabricate a cause for an older withdrawal", () => {
  const data = combatantDataOf({
    data: { exitReason: "withdrawn", exitCause: "guessed" },
  } as unknown as EncounterCombatant);
  expect(data.exitCause).toBeUndefined();
  const live = {
    state: { combatants: { h: { id: "h", name: "Lookout", defeated: true } } },
    data: { h: data },
  } as unknown as LiveEncounter;
  const html = renderToStaticMarkup(<CombatDepartures live={live} />);
  expect(html).toContain("Withdrew");
  expect(html).not.toContain("morale broke");
  expect(html).not.toContain("objective met");
});
