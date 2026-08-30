/**
 * What the job actually cost, read off the engine's own record.
 *
 * Settlement used to count one thing: Death Saves the engine itself failed.
 * Everything else a job did to the character's standing in Night City — the
 * firefight in a stairwell, the guard who saw their face when the Stealth check
 * came up short, the fact that they called for backup on a public street — left
 * no mark at all. A job you walked away from clean and a job that ended in a
 * shootout settled identically.
 *
 * So this replays the job's own ledger and reports what it finds, in the closed
 * observation vocabulary engine/clocks.ts already prices. Two properties make
 * that safe to trust:
 *
 *  - It reads events the ENGINE wrote — resolved attacks, failed checks, Death
 *    Saves, encounters it started. Not narration. A body the combat engine
 *    dropped is a body whether or not the GM mentioned it, and a model that
 *    forgets to report a firefight cannot make one free.
 *
 *  - It is a floor, not a ceiling. Observations the GM reported DURING the job
 *    were already priced when they happened; this catches what the fiction
 *    failed to mention, and deduplicates against nothing, because the two are
 *    counted on different events.
 *
 * Pure: events in, reports out. No dice, no network, no clock.
 */
import type { Observation } from "./clocks";

/**
 * The slice of a ledger row this module needs.
 *
 * Deliberately structural rather than the backend's row type: the engine may
 * not import from the app, and everything here is readable off any shape that
 * carries a type and a data bag.
 */
export type SettlementEvent = {
  type: string;
  data?: unknown;
};

/** How many of one observation a single job can report. */
export const MAX_PER_OBSERVATION = 4;

/** Shots fired in one job before the street has definitely noticed. */
export const LOUD_SHOT_THRESHOLD = 3;

function bag(event: SettlementEvent): Record<string, unknown> {
  return event.data && typeof event.data === "object" && !Array.isArray(event.data)
    ? (event.data as Record<string, unknown>)
    : {};
}

/**
 * Only this job's events.
 *
 * The ledger belongs to the whole campaign, so counting from the top would
 * charge job three for the bodies of job one. The last `mission_started` is
 * where this job begins.
 */
export function eventsForThisJob<T extends SettlementEvent>(events: T[]): T[] {
  const startedAt = events.map((e) => e.type).lastIndexOf("mission_started");
  return startedAt === -1 ? events : events.slice(startedAt + 1);
}

export type SettlementFinding = {
  observation: Observation;
  /** How many times it happened. */
  count: number;
  /** Why the engine says so, in the player's words. */
  because: string;
};

export type SettlementReadInput = {
  events: SettlementEvent[];
  /** The player's own name, so their Death Saves are not counted as kills. */
  playerName: string;
};

export type JobMechanicalCost = {
  hp: { before: number; after: number; lost: number } | null;
  armor: Array<{
    location: "head" | "body";
    before: number;
    after: number;
    ablated: number;
  }>;
  ammunition: Array<{
    inventoryId: string;
    weapon: string;
    before: number;
    after: number;
    spent: number;
  }>;
  criticalInjuries: number;
};

/**
 * The physical bill from a job, reconstructed from resolved attack events.
 * These values are for the receipt; live HP, SP and ammunition are persisted
 * when the encounter state is saved and remain the canonical current state.
 */
export function readMechanicalCost(input: SettlementReadInput): JobMechanicalCost {
  const events = eventsForThisJob(input.events);
  const playerHits = events.filter(
    (event) => event.type === "attack" && bag(event)["target"] === input.playerName,
  );
  const hpRows = playerHits.flatMap((event) => {
    const data = bag(event);
    return typeof data["hp_before"] === "number" && typeof data["hp_after"] === "number"
      ? [{ before: data["hp_before"], after: data["hp_after"] }]
      : [];
  });

  const armorByLocation = new Map<
    "head" | "body",
    { before: number; after: number; ablated: number }
  >();
  for (const event of playerHits) {
    const data = bag(event);
    const location = data["armor_location"] === "head" ? "head" : "body";
    const before = data["sp_before"];
    const after = data["sp_after"];
    if (typeof before !== "number" || typeof after !== "number") continue;
    const prior = armorByLocation.get(location);
    armorByLocation.set(location, {
      before: prior?.before ?? before,
      after,
      ablated: (prior?.ablated ?? 0) + Math.max(0, before - after),
    });
  }

  const ammoByInventory = new Map<
    string,
    { weapon: string; before: number; after: number; spent: number }
  >();
  for (const event of events) {
    if (event.type !== "attack") continue;
    const data = bag(event);
    const ammo = bag({ type: "ammo", data: data["ammo"] });
    const inventoryId = ammo["inventoryId"];
    const before = ammo["before"];
    const after = ammo["after"];
    if (
      typeof inventoryId !== "string" ||
      typeof before !== "number" ||
      typeof after !== "number"
    ) {
      continue;
    }
    const prior = ammoByInventory.get(inventoryId);
    ammoByInventory.set(inventoryId, {
      weapon: typeof data["weapon"] === "string" ? data["weapon"] : (prior?.weapon ?? "Weapon"),
      before: prior?.before ?? before,
      after,
      spent: (prior?.spent ?? 0) + Math.max(0, before - after),
    });
  }

  return {
    hp:
      hpRows.length > 0
        ? {
            before: hpRows[0]!.before,
            after: hpRows[hpRows.length - 1]!.after,
            lost: Math.max(0, hpRows[0]!.before - hpRows[hpRows.length - 1]!.after),
          }
        : null,
    armor: [...armorByLocation.entries()].map(([location, value]) => ({ location, ...value })),
    ammunition: [...ammoByInventory.entries()].map(([inventoryId, value]) => ({
      inventoryId,
      ...value,
    })),
    criticalInjuries: playerHits.filter((event) => bag(event)["critical_injury"] === true).length,
  };
}

/**
 * Read a finished job.
 *
 * Every rule here answers "what would somebody watching have been able to
 * tell?", because that is what the observation vocabulary is for.
 */
export function readSettlement(input: SettlementReadInput): SettlementFinding[] {
  const events = eventsForThisJob(input.events);
  const findings: SettlementFinding[] = [];
  const add = (observation: Observation, count: number, because: string) => {
    if (count > 0)
      findings.push({ observation, count: Math.min(count, MAX_PER_OBSERVATION), because });
  };

  // --- bodies -------------------------------------------------------------
  // A failed Death Save on somebody other than the player. The one record of a
  // death that exists whatever the narration said.
  const killed = events.filter((e) => {
    if (e.type !== "death_save") return false;
    const data = bag(e);
    return data["died"] === true && data["combatant"] !== input.playerName;
  }).length;
  add("killed", killed, `${killed} died`);

  // --- people who were hurt and lived -------------------------------------
  // Somebody the player hit hard enough to matter who is not among the dead.
  const hurt = new Set<string>();
  for (const event of events) {
    if (event.type !== "attack") continue;
    const data = bag(event);
    if (data["hit"] !== true) continue;
    if (data["attacker"] !== input.playerName) continue;
    const target = data["target"];
    const through = data["through_armor"];
    if (typeof target !== "string") continue;
    if (typeof through === "number" && through > 0) hurt.add(target);
  }
  const dead = new Set(
    events
      .filter((e) => e.type === "death_save" && bag(e)["died"] === true)
      .map((e) => bag(e)["combatant"])
      .filter((n): n is string => typeof n === "string"),
  );
  const wounded = [...hurt].filter((name) => !dead.has(name)).length;
  add("wounded", wounded, `${wounded} put in hospital`);

  // --- how loudly ---------------------------------------------------------
  // Gunfire in quantity. A single shot in a back room is not the street
  // noticing; a firefight is. Counted on resolved attacks, so a fight the
  // narration skipped over still counts.
  const shots = events.filter((e) => e.type === "attack").length;
  if (shots >= LOUD_SHOT_THRESHOLD) add("loud", 1, `${shots} shots exchanged`);

  // Calling for backup is a radio call somebody else can hear, and it brings
  // more people who can see you.
  const backup = events.filter((e) => e.type === "backup_called" && bag(e)["responded"] === true);
  if (backup.length > 0) add("witness", backup.length, "backup was called in");

  // --- being seen ---------------------------------------------------------
  // A blown Stealth check is the engine's own record that somebody clocked
  // them. Nothing else in the ledger says this as plainly.
  const blownStealth = events.filter((e) => {
    if (e.type !== "skill_check") return false;
    const data = bag(e);
    return data["success"] === false && data["skill_id"] === "stealth";
  }).length;
  add(
    "seen",
    blownStealth,
    `${blownStealth} failed attempt${blownStealth === 1 ? "" : "s"} to stay unseen`,
  );

  // --- or not ------------------------------------------------------------
  // Working clean is the only thing that takes pressure back off, so it has to
  // be earned by the whole job: no fight, nobody hurt, nobody spotted.
  const fought = events.some((e) => e.type === "encounter_started");
  if (!fought && findings.length === 0) {
    add("clean", 1, "no fight, nobody hurt, nobody spotted");
  }

  return findings;
}

/** The findings as the reports engine/clocks.ts prices, one per occurrence. */
export function reportsFrom<F>(
  findings: SettlementFinding[],
  factionId: F,
): { observation: Observation; factionId: F }[] {
  return findings.flatMap((finding) =>
    Array.from({ length: finding.count }, () => ({ observation: finding.observation, factionId })),
  );
}

/** "2 died · 5 shots exchanged" for the wrap-up screen. */
export function describeSettlement(findings: SettlementFinding[]): string {
  if (findings.length === 0) return "Nothing the city noticed.";
  return findings.map((f) => f.because).join(" · ");
}

// ---------------------------------------------------------------------------
// Who walked away.
// ---------------------------------------------------------------------------

/**
 * Words that are a job description rather than a person.
 *
 * A fight the GM staffed with "Guard", "Ganger 2" and "Security" produced three
 * targets and no people. Promoting those into the standing cast would fill the
 * character's life with strangers called Guard, which is the opposite of what a
 * recurring cast is for.
 */
const GENERIC_NAMES = new Set([
  "guard",
  "guards",
  "ganger",
  "gangers",
  "thug",
  "thugs",
  "goon",
  "goons",
  "mook",
  "merc",
  "mercs",
  "soldier",
  "soldiers",
  "security",
  "officer",
  "cop",
  "cops",
  "enforcer",
  "enforcers",
  "bouncer",
  "guy",
  "man",
  "woman",
  "worker",
  "technician",
  "scav",
  "scavs",
  "booster",
  "boosters",
  "contractor",
  "contractors",
  "sniper",
  "driver",
  "hostile",
  "target",
  "enemy",
]);

/**
 * True when a combatant's name reads as somebody rather than something.
 *
 * Deliberately strict: this decides whether a stranger becomes a permanent
 * fixture of the campaign, and the cost of being wrong is asymmetric. A real
 * person wrongly skipped is a missed opportunity; "Guard 2" wrongly promoted is
 * a recurring character called Guard 2.
 */
export function looksLikeAPerson(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return false;
  // "Ganger 2", "Guard #3" — numbered anything is a spawn, not a person.
  if (/\d/.test(trimmed)) return false;
  const words = trimmed.toLowerCase().split(/\s+/);
  const generic = words.some((word) => GENERIC_NAMES.has(word.replace(/[^a-z]/g, "")));
  // A job word anywhere in a short name means the name IS the job: "Guard",
  // "Corpo Enforcer". Three words or more can carry a title AND a name —
  // "Guard Captain Reyes" is a person who happens to be a guard captain.
  return !generic || words.length >= 3;
}

export type Survivor = { name: string };

/**
 * People the player fought, who have a name, and who did not die.
 *
 * Read from the ledger rather than the encounter rows because by the time a job
 * settles the fight is closed and gone. An attack names its target; a Death
 * Save names who it was for. Between them the ledger knows who was left
 * standing without anything needing to have been kept alive for it.
 */
export function survivorsFrom(input: SettlementReadInput): Survivor[] {
  const events = eventsForThisJob(input.events);
  const fought = new Set<string>();
  for (const event of events) {
    if (event.type !== "attack") continue;
    const data = bag(event);
    if (data["attacker"] !== input.playerName) continue;
    const target = data["target"];
    if (typeof target === "string" && looksLikeAPerson(target)) fought.add(target);
  }
  for (const event of events) {
    if (event.type !== "death_save" || bag(event)["died"] !== true) continue;
    const who = bag(event)["combatant"];
    if (typeof who === "string") fought.delete(who);
  }
  return [...fought].map((name) => ({ name }));
}
