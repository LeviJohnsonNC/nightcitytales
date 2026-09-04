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
  /** Their job in the standing cast: fixer, ripperdoc, landlord, and so on. */
  role?: string;
  /** One public line on who this person is to the character. */
  standing?: string;
  /** What the character's own Lifepath said about them, quoted. */
  tie?: string;
  /**
   * What the player has actually worked out about them. Absent facts are absent
   * on purpose: the engine holds the rest and the model is never shown it.
   */
  known?: string[];
};

/**
 * A job that EXISTS — generated, seeded and reloadable — waiting for the moment
 * the fiction reaches for it. Only the part a broker would say out loud: who is
 * calling, what they claim they want, and what they say it pays. Who is really
 * paying and what is really waiting are deliberately absent, so the model cannot
 * leak them even by accident.
 */
export type LifeWireOffer = {
  title: string;
  brokerName: string;
  brokerKey: string;
  brokerLine: string;
  district: string;
  pitch: string;
  ask: string;
  payout: number;
};

/** The same offer once it is on the table, plus anything the player has bought. */
export type LifeHookOnTable = LifeWireOffer & {
  /** Facts the player has already prised out of the broker or the street. */
  learned: string[];
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
  /** Organisations with an opinion of the character, already worded. */
  standings?: string[];
  /**
   * The campaign's long memory, assembled by the engine from what it knows for
   * certain. Six lines of recent narration is the right size for a turn and
   * the wrong size for a fifty-hour campaign.
   */
  chronicle?: string[];
  people: LifePersonSummary[];
  recentEvents: string[];
  capabilities?: string[];
  /** What the engine already resolved, when this turn is a follow-up. */
  resolved?: string;
  /**
   * The job the engine has ready — present ONLY on a night the wire oracle
   * actually produced work. Its presence therefore DOES mean the offer lands
   * this turn; whether there was work at all stopped being the model's decision
   * the day this field started being gated.
   */
  wire?: LifeWireOffer | null;
  /** The offer the player is currently sitting on, during the hook phase. */
  hookOnTable?: LifeHookOnTable | null;
  /**
   * Where the character physically is, out of the Night City Atlas. Canonical
   * geography: the model narrates this place, and may not relocate the
   * character on its own.
   */
  place?: {
    where: string;
    district: string;
    area: string;
    security: string;
    gangs: string[];
    combatZone: boolean;
    /**
     * Who answers when the street notices, and how fast — from the district's
     * own printed security provider. "Militech, at once" and "NCPD (in theory),
     * nobody comes" are the same field, and the difference between them is most
     * of what makes one district feel unlike another.
     */
    response?: string;
    /** What the money looks like here, and how busy the street is. */
    character?: string;
    /**
     * The ordinary business of being here, from the engine: what these places
     * actually support, each at a named venue. Given to the model so it stops
     * short of inventing a counter to buy something across.
     */
    business?: string[];
    /**
     * Somebody the character knows, who happens to be here. At most one — you
     * run into a person, you do not walk into a room containing your whole
     * address book. Presence only: they are here, they want nothing, and
     * whether that becomes anything is the player's move.
     */
    whoIsHere?: { name: string; key: string } | undefined;
    nearby: string[];
    /**
     * Good destinations to have in mind: what is underfoot, the named geography
     * within reach, everywhere already visited, and every district. Not a fence
     * — the engine resolves any canonical place in the city.
     */
    destinations?: string[];
    /** Neighbouring districts with their real compass heading and travel time. */
    neighbours?: string[];
    /** The major roads through this district, by name. */
    streets?: string[];
  } | null;
  /** True when the player asked what they could do, rather than doing it. */
  optionsRequested?: boolean;
  /**
   * What the dice said the street is doing tonight, when nothing else was
   * pressing. Rolled by the engine before this turn ran; the model dresses it
   * and is not allowed to overrule it.
   */
  street?: string | null;
  /**
   * A question the model asked last turn, and the answer the dice gave. It
   * arrives as something that was always true.
   */
  oracle?: { question: string; answer: string } | null;
};

function line(label: string, value: string): string {
  return `${label}: ${value}`;
}

/** The venue a situation belongs to, when it is one the ground produced. */
function placeOf(situation: LifeSituation): { name: string; atPlace: boolean } | null {
  const data = situation.data ?? {};
  const name = data["placeName"];
  if (typeof name !== "string" || !name) return null;
  return { name, atPlace: data["atPlace"] === true };
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

  if (context.place) {
    const p = context.place;
    parts.push("", "== WHERE YOU ARE ==");
    parts.push(line("Here", p.where));
    parts.push(line("District", `${p.district} (${p.area})`));
    if (p.security) parts.push(line("Security", p.security));
    if (p.response) parts.push(line("If the street notices", p.response));
    if (p.character) parts.push(line("The look of the place", p.character));
    if (p.whoIsHere) {
      parts.push(
        line("Somebody you know is here", `${p.whoIsHere.name} [${p.whoIsHere.key}]`),
        "They are simply here. They did not come to find the character and they want nothing " +
          "from them: write them into the scene as somebody who was already in it. Do not give " +
          "them an errand, a warning or a favour to ask — if they had one, you would have been " +
          "told.",
      );
    }
    if (p.business?.length) {
      parts.push(line("Ordinary business here", p.business.join(", ")));
      parts.push(
        "That is what these places support, not a list of what the player may do. They can try " +
          "anything; those are simply the things the engine already knows are possible here.",
      );
    }
    if (p.gangs.length) parts.push(line("Gangs", p.gangs.join(", ")));
    if (p.combatZone) parts.push(line("Note", "This is a Combat Zone. No law worth the name."));
    if (p.nearby.length) parts.push(line("Nearby places", p.nearby.join(", ")));
    if (p.streets?.length) {
      parts.push(line("Major roads through here", p.streets.join(", ")));
      parts.push(
        "Those are the arterials the atlas prints names for. The minor streets of Night City " +
          "are not written down anywhere you can see, so name one only if the player did.",
      );
    }
    if (p.neighbours?.length) {
      parts.push(
        "Districts this one BORDERS, and which way they lie (from the atlas, not from you):",
      );
      for (const n of p.neighbours) parts.push(`  - ${n}`);
      parts.push(
        'Never state a compass direction that is not in that list. If the player names a direction, propose travel with "direction" and let the engine walk the map. Districts not on this list are elsewhere in the city: reachable, but not next door, and not somewhere you may point to.',
      );
    }
    if (p.destinations?.length) {
      parts.push(line("Places worth naming (use the exact name)", p.destinations.join(", ")));
    }
    parts.push(
      "Narrate this location by name and use only these canonical places. " +
        "Do not move the character to another district yourself; travel is the player's call and the engine's clock. " +
        'When the player says they are going somewhere, propose {"kind":"travel","destination":"<exact name from the list above>"}. ' +
        "That list is what is worth suggesting, not the limit of where they can go: the engine " +
        "knows every district, venue, bridge, bay and canal in Night City. If the player names " +
        'somewhere that is not on it, put THEIR words in "destination" and let the engine ' +
        "resolve or refuse them. Never swap a place they named for a heading, and never invent a " +
        "street, bar or building that is not in the atlas.",
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
    // A situation that belongs to a place says so. Without this the narrator
    // gets "the water truck did not make it" with no idea that the water is at
    // the carwash, and invents somewhere for it to be.
    const where = placeOf(s);
    if (where) {
      parts.push(
        where.atPlace
          ? `This is happening at ${where.name}, and the character is there. Narrate it in front of them.`
          : `This is happening at ${where.name}, elsewhere in this district. The character is not there: they have heard about it, or can see it from where they are. Getting to it is their decision, not yours.`,
      );
    }
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

  const visibleClocks = context.clocks.filter((c) => !c.hidden && c.filled > 0);
  if (visibleClocks.length) {
    parts.push("", "== PRESSURE (the engine owns these; never state a number that disagrees) ==");
    for (const c of visibleClocks) parts.push(`- ${c.label}: ${c.filled}/${c.segments}`);
  }

  if (context.standings?.length) {
    parts.push("", "== WHO HAS AN OPINION ==");
    for (const line of context.standings) parts.push(`- ${line}`);
  }

  if (context.people.length) {
    parts.push(
      "",
      "== PEOPLE THEY KNOW (use these; do not invent new named faces while these exist) ==",
      "These are recurring characters. They keep their names, their voices and their grudges.",
    );
    for (const p of context.people.slice(0, 10)) {
      const seen = p.lastSeenDay ? `, last dealt with day ${p.lastSeenDay}` : ", not seen yet";
      const role = p.role ? `${p.role.replace(/_/g, " ")}, ` : "";
      parts.push(
        `- ${p.name} [${p.key}] (${role}disposition ${p.disposition}, ${p.status}${seen})`,
      );
      if (p.standing) parts.push(`    ${p.standing}`);
      if (p.tie) parts.push(`    From their history together: ${p.tie}`);
      for (const fact of p.known ?? []) parts.push(`    The player has worked out: ${fact}`);
      if (p.notes) parts.push(`    ${p.notes}`);
    }
    parts.push(
      "What is written above is ALL you know about these people. They have motives and " +
        "histories you have not been told; play them as people with their own business, and never " +
        "invent a want, a fear or a secret for them and state it as fact.",
    );
  }

  if (context.chronicle?.length) {
    parts.push("", "== THE RECORD SO FAR (facts; never contradict these) ==");
    for (const line of context.chronicle) parts.push(line);
  }

  if (context.recentEvents.length) {
    parts.push("", "== RECENT ==");
    for (const e of context.recentEvents) parts.push(`- ${e}`);
  }

  if (context.wire) {
    const w = context.wire;
    parts.push(
      "",
      "== WORK ON THE WIRE (the phone rang tonight: put THIS job on the table, this turn) ==",
      line("Job", w.title),
      line("Broker", `${w.brokerName} [${w.brokerKey}] — ${w.brokerLine}`),
      line("Where", w.district),
      line("Pays", `${w.payout}eb`),
      line("What they are asking for", w.ask),
      line("How they put it", w.pitch),
      'To put it on the table, return {"kind":"hook_offer"} and voice this in the broker\'s mouth. ' +
        "Change nothing: not the fee, not the name, not the ask.",
    );
  }

  if (context.hookOnTable) {
    const h = context.hookOnTable;
    parts.push(
      "",
      "== OFFER ALREADY ON THE TABLE ==",
      line("Job", `${h.title}, from ${h.brokerName} — ${h.payout}eb`),
      line("What they are asking for", h.ask),
    );
    if (h.learned.length) {
      parts.push("They have since found out:");
      for (const fact of h.learned) parts.push(`- ${fact}`);
    }
    parts.push(
      "The player has not agreed to anything. They may ask about it, push on the terms, sleep on " +
        "it or walk. Taking it is a button only they can press, and nothing else about this job " +
        "is yours to state.",
    );
  }

  if (context.street) {
    parts.push(
      "",
      "== THE STREET TONIGHT (rolled; this is what the evening is) ==",
      context.street,
      "This is a fact about the world, not a suggestion. If it says nothing happens, then nothing " +
        "happens: write the quiet honestly and do not smuggle in a stranger, a phone call or a " +
        "noise in the corridor to fill it.",
    );
  }

  if (context.oracle) {
    parts.push(
      "",
      "== YOU ASKED, AND THE WORLD ANSWERED ==",
      `You asked: ${context.oracle.question}`,
      `The answer is: ${context.oracle.answer}`,
      "Treat that as established fact and write from it. Do not restate the question to the " +
        "player, do not mention dice, and do not argue with the answer.",
    );
  }

  if (context.optionsRequested) {
    parts.push(
      "",
      "== THEY ARE ASKING WHAT THEY COULD DO ==",
      "Return 3-4 concrete actions drawn from the scene they are already standing in. Do not " +
        "advance the fiction, do not propose a check, and set timeSpent to 0: thinking about it " +
        "costs nothing.",
    );
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
