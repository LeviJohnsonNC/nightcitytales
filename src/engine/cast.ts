/**
 * The standing cast: the six people a campaign opens with.
 *
 * Night City is more frightening when it is populated by people you already
 * know. "Fuck, Razor is here" only works if Razor was there in week one, has a
 * name you did not choose, and has been carrying the same grudge the whole
 * time. So the cast is generated ONCE per campaign, deterministically, and
 * every later turn draws on it instead of inventing another intimidating
 * ganger named Vex.
 *
 * Three of the six exist because the game needs them: someone who brings work,
 * someone who installs chrome, someone who is the face of the rent. Three exist
 * because the character's own Lifepath already rolled them: the friend, the
 * enemy, and the one that ended badly. The Lifepath text is grafted on rather
 * than paraphrased, so what the player answered at creation is still true.
 *
 * WHAT THE AI IS TOLD, AND WHAT IT IS NOT
 * Every member carries a dossier: what they want, what they are afraid of, what
 * they are not telling you, and the line they will not cross. Only `standing`,
 * `tie` and disposition are public. The dossier is held by the engine and
 * released one rung at a time through play (see REVEAL_LADDER), because a model
 * that can see a secret will telegraph it, and a secret that is telegraphed
 * every turn was never a secret.
 *
 * Pure TypeScript, like the rest of the engine: content in, cast out, no dice
 * beyond the seeded stream and no knowledge of how any of it is stored.
 */
import content from "@/data/cast/cast-content.json";
import fitData from "@/data/cast/lifepath-fit.json";
import { seededRng } from "./dice";
import { clampDisposition } from "./campaign";
import { stableKey } from "./mission";
import type { RNG } from "./types";

export const CAST_ROLES = [
  "fixer",
  "ripperdoc",
  "landlord",
  "friend",
  "enemy",
  "old_flame",
] as const;
export type CastRole = (typeof CAST_ROLES)[number];

/** The three the game needs, whatever the Lifepath said. */
export const FUNCTIONAL_ROLES: CastRole[] = ["fixer", "ripperdoc", "landlord"];
/** The three the character's own Lifepath already rolled. */
export const PERSONAL_ROLES: CastRole[] = ["friend", "enemy", "old_flame"];

/**
 * What a person is actually carrying around. None of this is public.
 *
 * `wants` and `fear` are learnable by paying attention. `secret` is the thing
 * they are actively keeping. `breakingPoint` is not learned by insight at all:
 * you find it by asking them to cross it and being refused.
 */
export type Dossier = {
  wants: string;
  fear: string;
  secret: string;
  breakingPoint: string;
};

export type CastMember = {
  /** Stable npc key. The same person keeps it for the life of the campaign. */
  key: string;
  name: string;
  role: CastRole;
  /** One public line: who this person is to the character. Safe for the prompt. */
  standing: string;
  /**
   * What the character's own Lifepath says about them, when it said anything.
   * Public, and quoted rather than paraphrased.
   */
  tie: string | null;
  disposition: number;
  dossier: Dossier;
};

/**
 * Where each of the six starts. A friend is not neutral and an enemy is not a
 * stranger; opening everyone at zero would throw away the only relationship
 * information the character arrived with.
 */
export const STARTING_DISPOSITION: Record<CastRole, number> = {
  fixer: 1,
  ripperdoc: 1,
  landlord: 0,
  friend: 2,
  enemy: -2,
  old_flame: 0,
};

// ---------------------------------------------------------------------------
// Learning about people.
// ---------------------------------------------------------------------------

/**
 * The order a person opens up in. You notice what someone is chasing before you
 * notice what frightens them, and you learn what they are hiding last of all.
 */
export const REVEAL_LADDER = ["wants", "fear", "secret"] as const;
export type DossierFact = (typeof REVEAL_LADDER)[number];

export function isDossierFact(value: unknown): value is DossierFact {
  return typeof value === "string" && (REVEAL_LADDER as readonly string[]).includes(value);
}

/** The next rung this person has not given up yet, or null when fully read. */
export function nextUnknownFact(known: readonly DossierFact[]): DossierFact | null {
  return REVEAL_LADDER.find((fact) => !known.includes(fact)) ?? null;
}

/** One learned fact, phrased as something the character now knows. */
export function revealText(member: CastMember, fact: DossierFact): string {
  switch (fact) {
    case "wants":
      return `What ${member.name} is actually after: ${member.dossier.wants}`;
    case "fear":
      return `What ${member.name} is afraid of: ${member.dossier.fear}`;
    case "secret":
      return `What ${member.name} has not told you: ${member.dossier.secret}`;
  }
}

/**
 * How well a social check has to land before it tells you something about the
 * person you were talking to. Winning is not the same as reading somebody.
 */
export const INSIGHT_MARGIN = 5;

/**
 * WHICH Skills read a person, and what each one can reach, is `socialRead.ts`,
 * which reads this ladder and this margin. It deliberately depends on this
 * module and not the other way round: the dossier does not need to know what
 * anybody is rolling.
 */

// ---------------------------------------------------------------------------
// What the model is allowed to see.
// ---------------------------------------------------------------------------

export type CastPublicView = {
  key: string;
  name: string;
  role: CastRole;
  standing: string;
  tie: string | null;
  disposition: number;
  /** Only the rungs the player has actually earned. */
  known: string[];
  /**
   * True when they have noticed being worked and closed up. Public by
   * definition — being guarded is a thing you can see — and still only the
   * boolean: the suspicion NUMBER is the engine's and never goes in a prompt.
   */
  guarded?: boolean;
};

/**
 * The half of a person that may go in a prompt. Everything the player has not
 * learned is simply absent: the model cannot hint at what it was never given.
 */
export function publicView(
  member: CastMember,
  known: readonly DossierFact[],
  guarded = false,
): CastPublicView {
  return {
    ...(guarded ? { guarded: true } : {}),
    key: member.key,
    name: member.name,
    role: member.role,
    standing: member.standing,
    tie: member.tie,
    disposition: member.disposition,
    known: REVEAL_LADDER.filter((fact) => known.includes(fact)).map((fact) =>
      revealText(member, fact),
    ),
  };
}

// ---------------------------------------------------------------------------
// Generation.
// ---------------------------------------------------------------------------

type Pool = {
  label: string;
  names: string[];
  standing: string[];
  wants: string[];
  fear: string[];
  secret: string[];
  breakingPoint: string[];
};

const POOLS = content as unknown as Record<string, Pool>;

function poolFor(role: CastRole): Pool {
  const pool = POOLS[role];
  if (!pool) throw new Error(`Cast content has no pool for "${role}".`);
  return pool;
}

function pick(pool: string[], rng: RNG, what: string): string {
  if (pool.length === 0) throw new Error(`Cast content pool "${what}" is empty.`);
  const chosen = pool[Math.floor(rng() * pool.length)];
  if (chosen === undefined) throw new Error(`Cast content pool "${what}" produced nothing.`);
  return chosen;
}

/**
 * What the character's Lifepath already said about the people in their life.
 * Every field is optional: a character created without answering these still
 * gets a full cast, just without the personal ties written in.
 */
export type LifepathTies = {
  /** e.g. "A teacher or mentor." */
  friend?: string | null;
  /** The enemy, as rolled: who they are, what happened, what they can bring. */
  enemy?: { who?: string | null; cause?: string | null; throwAtYou?: string | null } | null;
  /** e.g. "Your lover mysteriously vanished." */
  tragicLove?: string | null;
};

/** "Ex-lover." reads as a fragment; "Ex-lover" run into the next table reads as a mistake. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * Fold the three rolled enemy tables into one readable line, skipping whatever
 * was never answered. The tables are separate rolls and read as separate facts,
 * so they are punctuated as separate facts rather than run together.
 */
function enemyTie(enemy: LifepathTies["enemy"]): string | null {
  if (!enemy) return null;
  const who = enemy.who?.trim();
  const cause = enemy.cause?.trim();
  const throwAtYou = enemy.throwAtYou?.trim();
  const parts: string[] = [];
  if (who) parts.push(sentence(who));
  if (cause) parts.push(sentence(cause));
  // What they can bring needs framing, or it reads as a description of them.
  if (throwAtYou) {
    parts.push(
      sentence(
        `They can bring ${throwAtYou.charAt(0).toLowerCase()}${throwAtYou.slice(1).replace(/\.$/, "")}`,
      ),
    );
  }
  return parts.length ? parts.join(" ") : null;
}

function tieFor(role: CastRole, ties: LifepathTies): string | null {
  switch (role) {
    case "friend":
      return ties.friend?.trim() || null;
    case "enemy":
      return enemyTie(ties.enemy);
    case "old_flame": {
      const love = ties.tragicLove?.trim();
      if (!love) return null;
      // The lover the Lifepath lost is not standing at the bar. Whoever holds
      // this slot came before, and the narrator is told so rather than handed
      // a death as somebody's shared history with a living person.
      return loverIsLost(love)
        ? `Not the one you lost. Your Lifepath says: "${sentence(love)}" This one came before that, and is still around.`
        : love;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Who can be the person the Lifepath already rolled.
// ---------------------------------------------------------------------------

type LifepathFit = {
  houseRule: boolean;
  enemyWho: Record<string, string[]>;
  tragicLove: Record<string, "lost" | string[]>;
};
const FIT = fitData as unknown as LifepathFit;

/** True when the fit table is what it claims to be: a house rule, tuned in data. */
export const LIFEPATH_FIT_IS_HOUSE_RULE: boolean = FIT.houseRule;

/** Table results are matched loosely: a trailing full stop or a capital is not a different roll. */
function norm(text: string): string {
  return text.trim().replace(/\.$/, "").toLowerCase();
}

function lookup<T>(table: Record<string, T>, value: string | null | undefined): T | undefined {
  if (!value?.trim()) return undefined;
  const wanted = norm(value);
  const hit = Object.keys(table).find((key) => norm(key) === wanted);
  return hit === undefined ? undefined : table[hit];
}

/** True when the rolled Tragic Love Affair leaves the lover dead or gone for good. */
export function loverIsLost(tragicLove: string | null | undefined): boolean {
  return lookup(FIT.tragicLove, tragicLove) === "lost";
}

/**
 * The names from a role's pool whose bio can be the person the Lifepath rolled.
 *
 * Every bio fixes who somebody is, and the Lifepath is quoted to the narrator
 * as their history with the character, so the two have to agree. A result the
 * table does not constrain, or text a player typed, leaves the pool whole; a
 * constraint that matches nobody in the pool also leaves it whole, because a
 * cast with a slight mismatch is better than a cast with nobody in it.
 */
export function namesFitting(role: CastRole, ties: LifepathTies, names: string[]): string[] {
  let allowed: string[] | undefined;
  if (role === "enemy") allowed = lookup(FIT.enemyWho, ties.enemy?.who);
  if (role === "old_flame") {
    const fit = lookup(FIT.tragicLove, ties.tragicLove);
    if (Array.isArray(fit)) allowed = fit;
  }
  if (!allowed) return names;
  const fitting = names.filter((name) => allowed.includes(name));
  return fitting.length ? fitting : names;
}

export type CastSeedInput = {
  /** Drawn once per campaign and stored, so the cast is the same cast forever. */
  seed: number;
  ties?: LifepathTies;
  /**
   * People the player chose by name while creating the character — the fixer
   * who interviewed them, and later whoever they picked for their enemy, friend
   * and lost love. A pick replaces the drawn NAME only, and only when it is a
   * name in that role's pool; the draw still happens, so every other field of
   * the cast lands exactly where it would have.
   */
  picks?: CastPicks;
};

/** Names chosen by the player, by role. */
export type CastPicks = Partial<Record<CastRole, string>>;

/**
 * What creation decided about the cast before there was a campaign: the seed
 * the six are drawn from, and whoever the player picked. Written into the saved
 * Lifepath so the campaign seeds the very people the player met.
 */
export type CastPlan = { seed: number; picks: CastPicks };

/** The key in the saved general Lifepath that carries creation's cast plan. */
export const CAST_PLAN_KEY = "castPlan";

/** Read a stored plan back, or null when there is none or it is not one. */
export function readCastPlan(value: unknown): CastPlan | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { seed?: unknown; picks?: unknown };
  if (typeof v.seed !== "number" || !Number.isFinite(v.seed)) return null;
  const picks: CastPicks = {};
  if (v.picks && typeof v.picks === "object") {
    for (const role of CAST_ROLES) {
      const name = (v.picks as Record<string, unknown>)[role];
      if (typeof name === "string" && poolFor(role).names.includes(name)) picks[role] = name;
    }
  }
  return { seed: v.seed >>> 0, picks };
}

/** How many fixers are waiting when a new character walks in. */
export const FIXERS_AT_THE_MEET = 3;

/**
 * The fixers who will see a new character tonight: a stable handful of the
 * pool, fixed by the plan's seed, so reloading the page does not reshuffle the
 * room. Separate stream from the cast's own, so choosing among them never
 * moves anybody else.
 */
export function fixerCandidates(seed: number, count = FIXERS_AT_THE_MEET): string[] {
  const rng = seededRng((seed ^ 0x5eed_f1e7) >>> 0);
  const names = [...poolFor("fixer").names];
  for (let i = names.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [names[i], names[j]] = [names[j]!, names[i]!];
  }
  return names.slice(0, Math.max(1, Math.min(count, names.length)));
}

/**
 * The six, built from a seed.
 *
 * Deterministic: the same seed and the same Lifepath always produce the same
 * people, down to the secrets. Draw order is fixed for the same reason it is
 * fixed in the job generator: reordering these lines would silently rewrite
 * every cast a stored seed names.
 */
export function generateCast(input: CastSeedInput): CastMember[] {
  const rng = seededRng(input.seed >>> 0);
  const ties = input.ties ?? {};
  const used = new Set<string>();
  const cast: CastMember[] = [];

  for (const role of CAST_ROLES) {
    const pool = poolFor(role);
    // Still one draw, so the rest of the stream lands where it always did.
    const drawn = pick(namesFitting(role, ties, pool.names), rng, `${role}.names`);
    const chosen = input.picks?.[role];
    const name = chosen && pool.names.includes(chosen) ? chosen : drawn;
    const member: CastMember = {
      key: uniqueKey(name, role, used),
      name,
      role,
      standing: pick(pool.standing, rng, `${role}.standing`),
      tie: tieFor(role, ties),
      disposition: clampDisposition(STARTING_DISPOSITION[role]),
      dossier: {
        wants: pick(pool.wants, rng, `${role}.wants`),
        fear: pick(pool.fear, rng, `${role}.fear`),
        secret: pick(pool.secret, rng, `${role}.secret`),
        breakingPoint: pick(pool.breakingPoint, rng, `${role}.breakingPoint`),
      },
    };
    cast.push(member);
  }
  return cast;
}

/** A key from the person's name, falling back to the role if two ever collide. */
function uniqueKey(name: string, role: CastRole, used: Set<string>): string {
  let key = stableKey(name);
  if (used.has(key)) key = `${role}_${key}`;
  used.add(key);
  return key;
}

/** The member holding a given job in the cast, if the campaign has one. */
export function memberInRole(cast: CastMember[], role: CastRole): CastMember | null {
  return cast.find((member) => member.role === role) ?? null;
}
