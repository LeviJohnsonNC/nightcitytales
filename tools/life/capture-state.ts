// Local rendering fixture. Only the capture runner resolves game reads to this module.
import type { Json } from "@/lib/backend";
import type { CheckRoll, PendingCheck } from "@/features/play/checkPrompt";
import { opposedCheckEvent, skillCheckEvent } from "@/features/campaign/skillCheckLog";
import { freshDb } from "@/features/life/__tests__/lifeTurnHarness";

const params = new URLSearchParams(location.search);
const apartment = params.get("place") === "p4";
const rollFixture = params.get("roll");
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
  role: rollFixture ? "solo" : "tech",
  portrait_path: "fixture/ren",
});
Object.assign(db.character.roleAbility!, { ability_id: "maker" });
db.character.skills.push({
  ...db.character.skills[0]!,
  skill_id: "basic_tech",
  level: rollFixture ? 6 : 5,
});
if (rollFixture) {
  db.character.stats.tech = 6;
  db.character.stats.cool = 6;
  db.character.skills.find((skill) => skill.skill_id === "persuasion")!.level = 6;
  db.vitals.luck_current = rollFixture === "empty" ? 0 : 5;
}
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
function event(type: string, summary: string, data: Json, roll: Json | null = null) {
  const seq = bundle.events.length + 1;
  bundle.events.push({
    campaign_id: db.campaign.id,
    beat_id: null,
    roll,
    id: String(seq),
    seq,
    type,
    summary,
    data,
    created_at: new Date().toISOString(),
  });
}
event(
  "life_narration",
  rollFixture ? "A scrap alternator lies on the workbench, its copper winding exposed." : passage,
  { title, walkOns },
);
if (rollFixture) {
  const opposed = rollFixture.startsWith("opposed");
  const intent = opposed
    ? "Convince Nao to release the parts."
    : "Strip usable copper wire from the scrap alternator.";
  event("check_prompt", intent, {
    skillId: opposed ? "persuasion" : "basic_tech",
    intent,
    ...(opposed
      ? {
          opposition: {
            npcKey: "nao",
            npcName: "Nao",
            skillId: "human_perception",
            statValue: 6,
            skillLevel: 6,
          },
        }
      : { dv: rollFixture === "failure" || rollFixture === "exact" ? 15 : 13 }),
  });
}

export async function loadLife() {
  const snapshot = structuredClone(bundle);
  if (rollFixture === "uncertain" && verifications === 1) {
    snapshot.events = snapshot.events.filter((row) => row.type !== "skill_check");
  }
  return snapshot;
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

let requests = 0;
let verifications = 0;
export async function findSavedLifeCheck(_campaignId: string, promptId: string) {
  if (rollFixture === "uncertain" && ++verifications === 1)
    throw new Error("Ledger connection interrupted.");
  return (
    bundle.events.find(
      (row) =>
        row.type === "skill_check" &&
        (row.data as { prompt_event_id?: string })?.prompt_event_id === promptId,
    ) ?? null
  );
}

export async function commitLifeCheck(_bundle: unknown, pending: PendingCheck, roll: CheckRoll) {
  requests++;
  document.documentElement.dataset.rollRequests = String(requests);
  if (rollFixture === "unsaved" && requests === 1)
    throw new Error("The connection dropped before saving.");
  const context = {
    promptEventId: pending.eventId,
    skillName: pending.skillName,
    skillId: pending.skillId,
    luckSpent: roll.luckSpent,
  };
  const row =
    roll.kind === "opposed"
      ? opposedCheckEvent(db.campaign.id, roll.result, context)
      : skillCheckEvent(db.campaign.id, roll.result, context);
  event(row.type, row.summary ?? "", row.data ?? {}, row.roll ?? null);
  bundle.vitals.luck_current = (bundle.vitals.luck_current ?? 5) - roll.luckSpent;
  if (rollFixture === "saved" || rollFixture === "uncertain")
    throw new Error("The narrator did not answer.");
  if (rollFixture === "slow") {
    await new Promise<void>((resolve) =>
      window.addEventListener("fixture-finish-roll", () => resolve(), { once: true }),
    );
  }
  event(
    "life_narration",
    roll.result.success
      ? "The winding comes free in one piece. You set the usable copper aside."
      : "The winding snaps inside the housing. You set the ruined alternator down.",
    { title, walkOns, resolvedCheckId: pending.eventId },
  );
}
