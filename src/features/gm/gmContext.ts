/**
 * Building the compact context slice the GM model sees each turn. Pure and
 * deterministic: it assembles ONLY what the model needs — the current beat, the
 * player's relevant sheet numbers, NPCs present, active objectives, and a rolling
 * summary of recent events — never the whole transcript. That bounded slice is
 * what keeps a long campaign from drifting.
 */
import { resolveSkillId } from "@/engine";
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
  /** Trained skills; `id` is the canonical skill id the GM must echo as skillId. */
  keySkills: { skill: string; base: number; id?: string }[];
};

export type GmNpcSummary = {
  name: string;
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
  clock?: string;
};

export type GmContext = GmContextInput;

export function buildGmContext(input: GmContextInput): GmContext {
  return input;
}

function line(label: string, value: string): string {
  return `${label}: ${value}`;
}

/** Render a skill reference with its canonical id in brackets, when resolvable. */
function withSkillId(label: string): string {
  const id = resolveSkillId(label);
  return id ? `${label} [id: ${id}]` : label;
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
        "Checks (DV set in advance; propose skill_check with the exact [id: ...])",
        beat.checks
          .map((c) => `${withSkillId(c.skill)} DV${c.dv}${c.note ? ` (${c.note})` : ""}`)
          .join("; "),
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
  if (character.keySkills.length) {
    parts.push(
      line(
        "Key skills (use the [id: ...] value as skillId when you propose a check)",
        character.keySkills
          .map((s) => `${s.skill} +${s.base}${s.id ? ` [id: ${s.id}]` : ""}`)
          .join(", "),
      ),
    );
  }

  const activeObjectives = context.objectives.filter((o) => o.status === "active");
  if (activeObjectives.length) {
    parts.push("", "== OBJECTIVES ==");
    for (const o of activeObjectives) parts.push(`- ${o.text}`);
  }

  if (context.npcsPresent.length) {
    parts.push("", "== NPCS PRESENT ==");
    for (const npc of context.npcsPresent) {
      parts.push(
        `- ${npc.name} (disposition ${npc.disposition}, ${npc.status})${npc.notes ? ` — ${npc.notes}` : ""}`,
      );
    }
  }

  if (context.recentEvents.length) {
    parts.push("", "== RECENT ==");
    for (const e of context.recentEvents) parts.push(`- ${e}`);
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
