/**
 * Building the compact context slice the GM model sees each turn. Pure and
 * deterministic: it assembles ONLY what the model needs — the current beat, the
 * player's relevant sheet numbers, NPCs present, active objectives, and a rolling
 * summary of recent events — never the whole transcript. That bounded slice is
 * what keeps a long campaign from drifting.
 */
import type { Beat, BeatExit, Mission, MissionObjective } from "@/engine";

export type GmCharacterSummary = {
  name: string;
  handle?: string;
  role: string;
  hp: number;
  hpMax: number;
  woundState: string;
  humanity?: number;
  humanityMax?: number;
  eurobucks?: number;
  stats: Record<string, number>;
  keySkills: { skill: string; id: string; base: number }[];
  /**
   * Every skill the model may name this turn — trained skills plus the Basic
   * Skills anyone rolls at Level 0 — so it always has a real id for the action.
   */
  availableSkills?: { skill: string; id: string; base: number }[];
};

export type GmNpcSummary = {
  name: string;
  /**
   * The stable key this NPC is stored under. Printed in the context so an
   * opposed check can name the same key twice and the campaign's memory of
   * their numbers actually gets hit.
   */
  key?: string;
  disposition: number;
  status: string;
  notes?: string;
};

export type GmContextInput = {
  mission: Mission;
  beat: Beat;
  availableExits: BeatExit[];
  character: GmCharacterSummary;
  objectives: MissionObjective[];
  npcsPresent: GmNpcSummary[];
  /** Rolling summary lines derived from the event ledger. */
  recentEvents: string[];
  /**
   * Player turns since dice last hit the table (see turnsSinceLastRoll). Rendered
   * as an explicit nudge once the table has gone cold, so "ROLL FOR IT" does not
   * rely on the system prompt alone surviving a long context.
   */
  turnsSinceLastRoll?: number;
  /**
   * What the character can actually do right now — weapons and what is loaded
   * in them, kit, chrome, Role Ability Rank, and what is left of the Turn.
   * Rendered verbatim so the model stops proposing the impossible; the
   * legality gate (src/engine/legality.ts) still refuses anything that slips
   * through.
   */
  capabilities?: string[];
  clock?: string;
  /**
   * True when the player asked what they could do rather than doing something.
   * The scene does not advance on such a turn: they are thinking, not acting.
   */
  optionsRequested?: boolean;
};

/** Turns without a roll before the context block starts calling it out. */
export const DRY_STREAK_THRESHOLD = 3;

export type GmContext = GmContextInput;

export function buildGmContext(input: GmContextInput): GmContext {
  return input;
}

function line(label: string, value: string): string {
  return `${label}: ${value}`;
}

/** Render the context + the player's input into the model's user prompt. */
export function renderGmUserPrompt(context: GmContext, playerInput: string): string {
  const { mission, beat, character } = context;
  const parts: string[] = [];

  parts.push("== SCENE ==");
  parts.push(line("Mission", `${mission.title} — Beat: ${beat.title} (${beat.type})`));
  if (context.clock) parts.push(line("Time", context.clock));
  parts.push(line("GM brief", beat.gmBrief));
  if (beat.readAloud) parts.push(line("Read-aloud", beat.readAloud));
  if (beat.checks?.length) {
    parts.push(
      line(
        "Checks (DV set in advance)",
        beat.checks.map((c) => `${c.skill} DV${c.dv}${c.note ? ` (${c.note})` : ""}`).join("; "),
      ),
    );
  }
  if (beat.opposition?.length) parts.push(line("Opposition", beat.opposition.join("; ")));
  if (context.availableExits.length) {
    parts.push(
      line(
        "Available choices",
        context.availableExits.map((e) => `[${e.to}] ${e.label}`).join(" | "),
      ),
    );
  }

  parts.push("", "== CHARACTER ==");
  parts.push(
    line(
      "Who",
      `${character.name}${character.handle ? ` "${character.handle}"` : ""} — ${character.role}`,
    ),
  );
  const vitals = [`HP ${character.hp}/${character.hpMax} (${character.woundState})`];
  if (character.humanity !== undefined && character.humanityMax !== undefined) {
    vitals.push(`Humanity ${character.humanity}/${character.humanityMax}`);
  }
  if (character.eurobucks !== undefined) vitals.push(`${character.eurobucks}eb`);
  parts.push(line("Vitals", vitals.join(", ")));
  parts.push(
    line(
      "STATS",
      Object.entries(character.stats)
        .map(([k, v]) => `${k.toUpperCase()} ${v}`)
        .join(", "),
    ),
  );
  const skillList = character.availableSkills?.length
    ? character.availableSkills
    : character.keySkills;
  if (skillList.length) {
    parts.push(
      "",
      "== SKILLS (use the id in [brackets] as skillId; these are the only valid ids) ==",
      skillList.map((s) => `${s.skill} [${s.id}] +${s.base}`).join(", "),
    );
  }

  if (context.capabilities?.length) {
    parts.push("", "== WHAT THEY CAN ACTUALLY DO (never propose anything outside this) ==");
    for (const c of context.capabilities) parts.push(`- ${c}`);
  }

  const activeObjectives = context.objectives.filter((o) => o.status === "active");
  if (activeObjectives.length) {
    parts.push("", "== OBJECTIVES ==");
    for (const o of activeObjectives) parts.push(`- ${o.text}`);
  }

  if (context.npcsPresent.length) {
    parts.push("", "== NPCS PRESENT (use the key in [brackets] as npcKey) ==");
    for (const npc of context.npcsPresent) {
      const key = npc.key ? ` [${npc.key}]` : "";
      parts.push(
        `- ${npc.name}${key} (disposition ${npc.disposition}, ${npc.status})${npc.notes ? ` — ${npc.notes}` : ""}`,
      );
    }
  }

  if (context.recentEvents.length) {
    parts.push("", "== RECENT ==");
    for (const e of context.recentEvents) parts.push(`- ${e}`);
  }

  const dry = context.turnsSinceLastRoll;
  if (dry !== undefined && dry >= DRY_STREAK_THRESHOLD) {
    parts.push(
      "",
      "== DICE ==",
      `The player has not rolled in ${dry} turns. That is too long. Unless they are ` +
        "purely moving or talking, find the check in what they are about to do and propose it.",
    );
  }

  if (context.optionsRequested) {
    parts.push(
      "",
      "== THEY ARE ASKING WHAT THEY COULD DO ==",
      "Fill suggestedActions with 3-4 concrete things drawn from the scene you already " +
        "described. Do not advance the fiction, do not propose a check, and do not narrate a new " +
        "moment: restate where they are standing and stop.",
    );
  }

  parts.push("", "== PLAYER INPUT ==", playerInput);
  return parts.join("\n");
}

export function objectiveFor(
  objectives: MissionObjective[],
  id: string,
): MissionObjective | undefined {
  return objectives.find((o) => o.id === id);
}
