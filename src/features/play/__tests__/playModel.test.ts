import { describe, expect, it } from "vitest";
import type { CampaignEvent, CampaignNpc, CampaignVitals, FullCharacter } from "@/lib/backend";
import {
  actorFor,
  characterSummary,
  findNpcByKey,
  gmSkillList,
  npcDispositionAfter,
  keySkills,
  suggestionInput,
  jobOutcome,
  npcSummaries,
  recentEventLines,
  turnsSinceLastRoll,
} from "../playModel";

const full = {
  character: { name: "Vincent Kang", handle: "Switchblade", role: "solo" },
  stats: { ref: 8, body: 6, dex: 5, cool: 4, int: 6, tech: 4, will: 6, luck: 5, move: 6, emp: 4 },
  skills: [
    { skill_id: "handgun", level: 6 },
    { skill_id: "athletics", level: 2 },
    { skill_id: "brawling", level: 0 },
  ],
} as unknown as FullCharacter;

const vitals = {
  hp_current: 32,
  hp_max: 40,
  wound_state: "light",
  humanity_current: 44,
  humanity_max: 60,
  eurobucks: 1030,
} as unknown as CampaignVitals;

describe("actorFor", () => {
  it("extracts stats and skill levels", () => {
    const actor = actorFor(full);
    expect(actor.stats.ref).toBe(8);
    expect(actor.skills).toContainEqual({ skillId: "handgun", level: 6 });
  });
});

describe("keySkills", () => {
  it("lists trained skills as Skill+base, highest first, dropping level-0", () => {
    const skills = keySkills(full);
    expect(skills[0]).toEqual({ skill: "Handgun", id: "handgun", base: 14 }); // REF 8 + 6
    expect(skills.some((s) => s.skill === "Brawling")).toBe(false); // level 0 dropped
  });
});

describe("characterSummary", () => {
  it("merges sheet and live vitals", () => {
    const s = characterSummary(full, vitals);
    expect(s).toMatchObject({
      name: "Vincent Kang",
      handle: "Switchblade",
      role: "solo",
      hp: 32,
      hpMax: 40,
      woundState: "light",
      humanity: 44,
      eurobucks: 1030,
    });
  });
});

describe("npcSummaries & recentEventLines", () => {
  it("maps NPCs and recent events to compact forms", () => {
    const npcs = npcSummaries([
      {
        name: "The Master",
        disposition: 1,
        status: "alive",
        location: "Symphony Hall",
      } as CampaignNpc,
    ]);
    expect(npcs[0]).toMatchObject({
      name: "The Master",
      disposition: 1,
      notes: "at Symphony Hall",
    });

    const lines = recentEventLines([
      { summary: "Campaign started in Night City.", type: "campaign_started" } as CampaignEvent,
      { summary: null, type: "beat_advanced" } as CampaignEvent,
    ]);
    expect(lines).toEqual(["Campaign started in Night City.", "beat_advanced"]);
  });
});

describe("turnsSinceLastRoll", () => {
  const ev = (type: string): CampaignEvent => ({ type }) as unknown as CampaignEvent;

  it("counts player turns back to the last roll", () => {
    const events = [
      ev("player_input"),
      ev("skill_check"),
      ev("gm_narration"),
      ev("player_input"),
      ev("gm_narration"),
      ev("player_input"),
    ];
    expect(turnsSinceLastRoll(events)).toBe(2);
  });

  it("is zero when the player just rolled", () => {
    expect(turnsSinceLastRoll([ev("player_input"), ev("skill_check")])).toBe(0);
  });

  it("counts every turn when nothing has ever been rolled", () => {
    const events = [ev("player_input"), ev("gm_narration"), ev("player_input")];
    expect(turnsSinceLastRoll(events)).toBe(2);
  });

  it("treats attacks and death saves as dice hitting the table", () => {
    expect(turnsSinceLastRoll([ev("attack"), ev("player_input")])).toBe(1);
    expect(turnsSinceLastRoll([ev("death_save"), ev("player_input")])).toBe(1);
  });

  it("ignores narration and prompts, which are not rolls", () => {
    const events = [ev("skill_check"), ev("player_input"), ev("check_prompt"), ev("gm_narration")];
    expect(turnsSinceLastRoll(events)).toBe(1);
  });

  it("is zero for an empty ledger", () => {
    expect(turnsSinceLastRoll([])).toBe(0);
  });
});

describe("jobOutcome", () => {
  it("is null while the job is still being played", () => {
    expect(jobOutcome("active", "active")).toBeNull();
    expect(jobOutcome("active", null)).toBeNull();
  });

  it("reports a completed job from the mission, not the campaign", () => {
    // The campaign stays active across jobs — it is the character's run, so the
    // job's own status is the only thing that says the job is done.
    expect(jobOutcome("active", "completed")).toBe("completed");
  });

  it("reports death from the campaign, which death does close", () => {
    expect(jobOutcome("lost", "active")).toBe("died");
  });

  it("treats death as final even on a job that reached its Resolution", () => {
    expect(jobOutcome("lost", "completed")).toBe("died");
  });

  it("does not treat a failed or abandoned job as finished", () => {
    expect(jobOutcome("active", "failed")).toBeNull();
    expect(jobOutcome("active", "abandoned")).toBeNull();
  });

  it("only recognises statuses the campaigns table actually permits", () => {
    // 'completed' and 'dead' were written here once; both violate the CHECK on
    // campaigns.status, so neither may ever mean anything again.
    expect(jobOutcome("completed", "active")).toBeNull();
    expect(jobOutcome("dead", "active")).toBeNull();
  });
});

describe("gmSkillList", () => {
  it("lists trained skills and the Basic Skills they are untrained in", () => {
    const list = gmSkillList(full);
    expect(list[0]).toEqual({ skill: "Handgun", id: "handgun", base: 14 });
    // Persuasion was never bought, but everyone rolls it at Level 0 (COOL 4).
    expect(list).toContainEqual({ skill: "Persuasion", id: "persuasion", base: 4 });
  });

  it("never lists a skill twice", () => {
    const ids = gmSkillList(full).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("suggestionInput", () => {
  it("sends an untagged suggestion as its plain label", () => {
    expect(suggestionInput({ label: "Case the side entrance", skill: null })).toBe(
      "Case the side entrance",
    );
  });

  it("carries a tagged suggestion's skill back as an engine note", () => {
    const sent = suggestionInput({ label: "Talk the guard down", skill: "persuasion" });
    expect(sent).toContain("Talk the guard down");
    expect(sent).toContain("persuasion");
    expect(sent).toContain("skill_check");
  });
});

describe("findNpcByKey", () => {
  const npcs = [
    { npc_id: "trace-santiago", name: "Trace Santiago" },
    { npc_id: null, name: "The Doorman" },
  ] as unknown as CampaignNpc[];

  it("finds an NPC by the key the GM was shown", () => {
    expect(findNpcByKey(npcs, "trace-santiago")?.name).toBe("Trace Santiago");
  });

  it("falls back to the name when the GM retyped the key", () => {
    // A new key for a face the campaign already knows must not read as a
    // stranger with fresh numbers.
    expect(findNpcByKey(npcs, "trace_santiago", "Trace Santiago")?.npc_id).toBe("trace-santiago");
  });

  it("matches a name case- and space-insensitively", () => {
    expect(findNpcByKey(npcs, "doorman", "  the doorman ")?.name).toBe("The Doorman");
  });

  it("returns null for someone the campaign has never met", () => {
    expect(findNpcByKey(npcs, "unknown-fixer", "Unknown Fixer")).toBeNull();
  });
});

describe("npcSummaries", () => {
  it("carries the stable key so the GM can name it back", () => {
    const summaries = npcSummaries([
      { npc_id: "trace-santiago", name: "Trace Santiago", disposition: 1, status: "alive" },
    ] as unknown as CampaignNpc[]);
    expect(summaries[0]).toMatchObject({ name: "Trace Santiago", key: "trace-santiago" });
  });
});

describe("npcDispositionAfter", () => {
  it("moves an NPC the campaign already knows", () => {
    expect(npcDispositionAfter({ disposition: 1 }, -2)).toEqual({ disposition: -1, isNew: false });
  });

  it("starts a stranger from neutral", () => {
    expect(npcDispositionAfter(null, 2)).toEqual({ disposition: 2, isNew: true });
  });

  it("bottoms out at hostile rather than running away", () => {
    // A run of bad turns cannot drive someone to -12.
    expect(npcDispositionAfter({ disposition: -3 }, -5).disposition).toBe(-3);
  });

  it("tops out at devoted", () => {
    expect(npcDispositionAfter({ disposition: 3 }, 4).disposition).toBe(3);
  });
});
