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
  /** Where the job is happening, out of the Night City Atlas. */
  place?: {
    where: string;
    district: string;
    area: string;
    security: string;
    gangs: string[];
    combatZone: boolean;
    nearby: string[];
  } | null;
  /**
   * True when the player asked what they could do rather than doing something.
   * The scene does not advance on such a turn: they are thinking, not acting.
   */
  optionsRequested?: boolean;
  /** Clocks with something on them, already worded by the engine. */
  pressure?: string[];
  /** Organisations with an opinion, already worded by the engine. */
  standings?: string[];
  /**
   * The campaign's long memory, assembled by the engine from what it knows for
   * certain. The rolling summary is the right size for a turn and the wrong
   * size for a campaign forty hours deep.
   */
  chronicle?: string[];
  /**
   * A clock that filled and has been SPENT: this is arriving now, in this scene,
   * whether or not the beat graph expected it. The engine has already decided it
   * happened; the GM's job is to show it walking through the door.
   */
  arrived?: string | null;
  /**
   * What this job's brief left out, rolled in secret when the player took the
   * work. The GM did not choose it and cannot roll it away: it is a fact about
   * the job that has been true since before the first beat.
   */
  complication?: string | null;
  /**
   * A question the GM asked last turn, and what the dice said. It arrives as
   * something that was always true.
   */
  oracle?: { question: string; answer: string } | null;
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

  // WHO is waiting, settled from the job's own seed when the job was generated
  // — before the offer was pitched, argued over, or narrated. Handed over as
  // fact, the way the chronicle is: the model casts the fight it is told about
  // rather than inventing a roster to suit the scene.
  const force = context.mission.force;
  if (force && beat.encounter) {
    parts.push(
      line(
        "OPPOSITION FORCE (this IS the fight — use these profiles, this many)",
        force.members.map((m) => `${m.name} [${m.key}] profile:${m.profile.key}`).join(" | "),
      ),
    );
  }
  if (context.availableExits.length) {
    parts.push(
      line(
        "Available choices",
        context.availableExits.map((e) => `[${e.to}] ${e.label}`).join(" | "),
      ),
    );
  }

  if (context.place) {
    const p = context.place;
    parts.push("", "== WHERE YOU ARE ==");
    parts.push(line("Here", p.where));
    parts.push(line("District", `${p.district} (${p.area})`));
    if (p.security) parts.push(line("Security", p.security));
    if (p.gangs.length) parts.push(line("Gangs", p.gangs.join(", ")));
    if (p.combatZone) parts.push(line("Note", "Combat Zone. Nobody is coming when it goes loud."));
    if (p.nearby.length) parts.push(line("Nearby places", p.nearby.join(", ")));
    parts.push("Use these canonical names. Do not invent districts or relocate the job.");
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

  if (context.pressure?.length) {
    parts.push("", "== PRESSURE (the engine owns these; never state a number that disagrees) ==");
    for (const line of context.pressure) parts.push(`- ${line}`);
  }

  if (context.standings?.length) {
    parts.push("", "== WHO HAS AN OPINION ==");
    for (const line of context.standings) parts.push(`- ${line}`);
  }

  if (context.arrived) {
    parts.push(
      "",
      "== IT HAS CAUGHT UP WITH THEM, NOW ==",
      context.arrived,
      "This is happening in this scene. The engine has already decided it: do not ask whether it " +
        "fits the beat, do not delay it to a better moment, and do not soften it. Show it arriving, " +
        "put the player in it, and stop.",
    );
  }

  if (context.chronicle?.length) {
    parts.push("", "== THE RECORD SO FAR (facts; never contradict these) ==");
    for (const line of context.chronicle) parts.push(line);
  }

  if (context.complication) {
    parts.push(
      "",
      "== WHAT THE BRIEF LEFT OUT (the player does not know this) ==",
      context.complication,
      "This was rolled before the job started and it is true. Build the job around it: let it show " +
        "in what is actually there — who is already inside, what is missing, who arrives — rather " +
        "than announcing it. Do not state it outright, do not let an NPC conveniently confess it, " +
        "and do not decide it is not true after all because the job is going well or badly.",
    );
  }

  if (context.oracle) {
    parts.push(
      "",
      "== YOU ASKED, AND THE WORLD ANSWERED ==",
      `You asked: ${context.oracle.question}`,
      `The answer is: ${context.oracle.answer}`,
      "Treat that as established fact and narrate from it. Do not restate the question to the " +
        "player, do not mention dice, and do not argue with the answer.",
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
