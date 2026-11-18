// Local rendering fixture. Only the capture runner resolves game reads to this module.
import type { Json } from "@/lib/backend";
import { freshDb } from "@/features/life/__tests__/lifeTurnHarness";

const params = new URLSearchParams(location.search);
const apartment = params.get("place") === "p4";
const db = freshDb({ location: apartment ? "p4" : "o3", day: 1 });
Object.assign(db.campaign, {
  name: "Fixer in Night City",
  home_place_key: "p4",
  minute: 1092,
  known_places: ["o3", "p4", "h8"],
});
Object.assign(db.character.character, {
  name: "Ren",
  handle: "",
  role: "tech",
  portrait_path: "fixture/ren",
});
Object.assign(db.character.roleAbility!, { ability_id: "maker" });
db.character.skills.push({ ...db.character.skills[0]!, skill_id: "basic_tech", level: 5 });
const clock = { day: 1, minute: 1092 };
const walkOns = apartment
  ? [{ subject: "motel-desk-clerk", gender: "female" }]
  : [{ subject: "noodle-bar-cook", gender: "male", face: "noodle-bar-cook-male-older" }];
const title = apartment ? "Back in the Box" : "Ganymede Street Market";
const passage = apartment
  ? "The clerk looks up as you pass the chicken-wire desk. By the time your container door grinds shut, the argument two floors down is just a murmur.\n\nYour workbench is right where you left it."
  : "Steam rolls off the noodle stalls under a tangle of string lights. Past the cook, a hardware counter sits behind wire mesh and scarred plexiglass.\n\nMama Ishii sets down a greasy rag. Her eyes find yours.";
const bundle = {
  ...db,
  clock,
  current: null,
  phase: "life",
  neighborhood: {},
  places: {},
  cyberware: [],
  pressure: [],
  standings: [],
  sheet: [],
  discoveredTruths: [],
  pinnedGoals: [],
  lastFrame: null,
  hook: null,
  climb: { reputation: { level: 0 }, tier: { tier: { id: "street", name: "Street" } } },
  tally: { jobsFinished: 0 },
  ipAward: { daysUntil: 6 },
};
function event(type: string, summary: string, data: Json) {
  const seq = bundle.events.length + 1;
  bundle.events.push({
    campaign_id: db.campaign.id,
    beat_id: null,
    roll: null,
    id: String(seq),
    seq,
    type,
    summary,
    data,
    created_at: new Date().toISOString(),
  });
}
event("life_narration", passage, { title, walkOns });

export async function loadLife() {
  return structuredClone(bundle);
}
export async function liveTurn(
  _bundle: unknown,
  input: string,
  turn: { options?: boolean; minutes?: number; spend?: { amount: number } },
) {
  if (turn.options) {
    event("life_options", "", {
      actions: [
        {
          label: "Ask about new stock",
          description: "Ask who brought in the parts.",
          timeMinutes: 5,
          knownCost: null,
          skillId: null,
        },
        {
          label: "Inspect the parts",
          description: "Test the worn connector.",
          timeMinutes: 10,
          knownCost: 5,
          skillId: "basic_tech",
        },
      ],
    });
  } else if (input.includes("Inspect the parts")) {
    bundle.clock.minute += turn.minutes ?? 0;
    bundle.vitals.eurobucks -= turn.spend?.amount ?? 0;
    event("life_narration", "The connector has been filed down. You lean in for a closer look.", {
      title,
      walkOns,
    });
    event("check_prompt", "Inspect the connector", {
      intent: "Inspect the connector",
      skillId: "basic_tech",
      dv: 13,
    });
  } else {
    throw new Error("The capture fixture has no reply for this turn.");
  }
}
