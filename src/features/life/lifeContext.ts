/**
 * The compact context slice the LIFE model sees each turn. Pure and
 * deterministic, like gmContext.ts: the clock, the character's real numbers,
 * the ONE situation the app selected, the standing pressures, the people who
 * matter, and what the character can actually do. Nothing else.
 */
import { formatLifeClock, formatDuration, partOfDay, type GameClock } from "@/engine";
import type { LifeSituation, LifeClock } from "@/engine";

export type LifePersonSummary = {
  key: string;
  name: string;
  disposition: number;
  status: string;
  lastSeenDay?: number;
  notes?: string;
};

export type LifeContext = {
  clock: GameClock;
  character: {
    name: string;
    handle?: string;
    role: string;
    hp: number;
    hpMax: number;
    woundState: string;
    humanity?: number;
    humanityMax?: number;
    eurobucks: number;
    stats: Record<string, number>;
    skills: { skill: string; id: string; base: number }[];
  };
  /** The situation the application chose for this turn. */
  situation: LifeSituation | null;
  /** Everything else still live, so the model can keep continuity. */
  otherSituations: LifeSituation[];
  clocks: LifeClock[];
  people: LifePersonSummary[];
  recentEvents: string[];
  capabilities?: string[];
  /** What the engine already resolved, when this turn is a follow-up. */
  resolved?: string;
};

function line(label: string, value: string): string {
  return `${label}: ${value}`;
}

/** Render the Life context + the player's input into the model's user prompt. */
export function renderLifeUserPrompt(context: LifeContext, playerInput: string): string {
  const parts: string[] = [];
  const { character } = context;

  parts.push("== PHASE ==");
  parts.push(
    "LIFE. The character is between jobs. You cannot start a job, a fight or a mission. " +
      "A job may only appear as a hook_offer the player is free to refuse.",
  );

  parts.push("", "== CLOCK ==");
  parts.push(
    line(
      "Now",
      `${formatLifeClock(context.clock)} (day ${context.clock.day}, ${partOfDay(context.clock.minute)})`,
    ),
  );

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
  vitals.push(`${character.eurobucks}eb`);
  parts.push(line("Vitals", vitals.join(", ")));
  parts.push(
    line(
      "STATS",
      Object.entries(character.stats)
        .map(([k, v]) => `${k.toUpperCase()} ${v}`)
        .join(", "),
    ),
  );
  if (character.skills.length) {
    parts.push(
      "",
      "== SKILLS (use the id in [brackets] as skillId; these are the only valid ids) ==",
      character.skills.map((s) => `${s.skill} [${s.id}] +${s.base}`).join(", "),
    );
  }

  if (context.capabilities?.length) {
    parts.push("", "== WHAT THEY CAN ACTUALLY DO (never propose anything outside this) ==");
    for (const c of context.capabilities) parts.push(`- ${c}`);
  }

  parts.push("", "== CURRENT SITUATION (dress this one; do not replace it) ==");
  if (context.situation) {
    const s = context.situation;
    parts.push(
      `[${s.category}] ${s.title} — ${s.summary}` +
        (s.npcKey ? ` (NPC: ${s.npcKey})` : "") +
        (s.dueDay !== undefined ? ` (comes due on day ${s.dueDay})` : "") +
        ` (severity ${s.severity}/5)`,
    );
  } else {
    parts.push(
      "Nothing is pressing. Give them a quiet, specific moment in their own life and three " +
        "concrete things they could do with the evening.",
    );
  }

  if (context.otherSituations.length) {
    parts.push("", "== ALSO OUTSTANDING (continuity only; do not switch to these) ==");
    for (const s of context.otherSituations.slice(0, 6)) {
      parts.push(`- [${s.category}] ${s.title} — ${s.summary}`);
    }
  }

  const visibleClocks = context.clocks.filter((c) => !c.hidden);
  if (visibleClocks.length) {
    parts.push("", "== PRESSURES ==");
    for (const c of visibleClocks) parts.push(`- ${c.label}: ${c.filled}/${c.segments}`);
  }

  if (context.people.length) {
    parts.push("", "== PEOPLE THEY KNOW (prefer these over new faces; use the key as npcKey) ==");
    for (const p of context.people.slice(0, 10)) {
      const seen = p.lastSeenDay !== undefined ? `, last dealt with day ${p.lastSeenDay}` : "";
      parts.push(
        `- ${p.name} [${p.key}] (disposition ${p.disposition}, ${p.status}${seen})${p.notes ? ` — ${p.notes}` : ""}`,
      );
    }
  }

  if (context.recentEvents.length) {
    parts.push("", "== RECENT ==");
    for (const e of context.recentEvents) parts.push(`- ${e}`);
  }

  if (context.resolved) {
    parts.push(
      "",
      "== ALREADY RESOLVED BY THE ENGINE ==",
      context.resolved,
      "Narrate exactly this in 1-3 sentences. Do not change a number and do not re-roll it.",
    );
  }

  parts.push("", "== PLAYER INPUT ==", playerInput);
  return parts.join("\n");
}

/** "20 min" for an action card — re-exported so the UI and prompt agree. */
export const describeDuration = formatDuration;
