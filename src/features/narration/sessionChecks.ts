/**
 * What only shows over several turns.
 *
 * Every check in `narratorChecks.ts` looks at one turn, so a narrator that is
 * fine each time and wrong across a scene passes all of them: the room described
 * again on the fourth turn, the bartender's line quoted back a second time, the
 * same closing beat on every reply. A session is a scripted run of turns in one
 * scene, each answered by the model and fed into the next turn's RECENT block the
 * way play feeds it. These are the detectors for what that shows.
 *
 * Pure and model-free like the rest: `evals/` runs them on live sessions, and
 * `sessionChecks.test.ts` runs them on hand-written prose in CI. The single-turn
 * checks still run on every turn of a session; these are only the ones that need
 * more than one.
 */
import type { CheckableTurn, Finding } from "./narratorChecks";

export type SessionCheck = {
  id: string;
  title: string;
  /** Where the rule is written down. */
  source: string;
  /** Findings across the whole session; `turn` is the 1-based turn each one was found in. */
  run(turns: CheckableTurn[], scene?: SessionScene): (Finding & { turn: number })[];
};

/**
 * How many words in a row a later turn may share with an earlier one before it
 * counts as saying it again. A name, a place and a verb recur honestly ("the
 * bartender wipes the counter" is four words); a whole clause coming back is not.
 * A guess, held in one place so it can be tuned from real sessions.
 */
export const REPEAT_RUN_WORDS = 7;

/** Lowercase words with their original spans, punctuation dropped. */
function wordsOf(text: string): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}'’]+/gu)) {
    out.push({
      word: m[0].toLowerCase().replace(/’/g, "'"),
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
    });
  }
  return out;
}

/**
 * The longest runs of words `later` shares with `earlier`, at least
 * `REPEAT_RUN_WORDS` long, quoted as they appear in `later`.
 */
export function sharedRuns(earlier: string, later: string, minWords = REPEAT_RUN_WORDS): string[] {
  const a = wordsOf(earlier).map((w) => w.word);
  const b = wordsOf(later);
  const seen = new Set<string>();
  for (let i = 0; i + minWords <= a.length; i += 1) seen.add(a.slice(i, i + minWords).join(" "));
  const runs: string[] = [];
  let i = 0;
  while (i + minWords <= b.length) {
    if (
      !seen.has(
        b
          .slice(i, i + minWords)
          .map((w) => w.word)
          .join(" "),
      )
    ) {
      i += 1;
      continue;
    }
    // Extend while the next window is also shared, so a long echo is one finding.
    let end = i + minWords;
    while (
      end < b.length &&
      seen.has(
        b
          .slice(end - minWords + 1, end + 1)
          .map((w) => w.word)
          .join(" "),
      )
    ) {
      end += 1;
    }
    runs.push(later.slice(b[i]!.start, b[end - 1]!.end));
    i = end;
  }
  return runs;
}

export const doesNotRepeatItself: SessionCheck = {
  id: "does-not-repeat-itself",
  title: "did not say again what an earlier turn already said",
  source:
    'narratorRules.ts ALREADY_HERE_LINE: "DO NOT DESCRIBE IT AGAIN, not the room, not the smell, not the light."',
  run(turns) {
    const findings: (Finding & { turn: number })[] = [];
    for (let t = 1; t < turns.length; t += 1) {
      const said = turns[t]!.narration;
      for (let e = 0; e < t; e += 1) {
        for (const run of sharedRuns(turns[e]!.narration, said)) {
          findings.push({ turn: t + 1, quote: run, note: `already said in turn ${e + 1}` });
        }
      }
    }
    return findings;
  },
};

/**
 * Jobs a person is called in prose, folded to one word each so "the barkeep" and
 * "the bartender" are the same seat behind the same counter.
 */
const ROLE_WORDS: Record<string, string> = {
  bartender: "bartender",
  barkeep: "bartender",
  barkeeper: "bartender",
  barman: "bartender",
  bouncer: "bouncer",
  doorman: "doorman",
  guard: "guard",
  porter: "porter",
  clerk: "clerk",
  cashier: "cashier",
  cook: "cook",
  chef: "cook",
  waitress: "waiter",
  waiter: "waiter",
  dealer: "dealer",
  mechanic: "mechanic",
  ripperdoc: "ripperdoc",
  fixer: "fixer",
  driver: "driver",
  vendor: "vendor",
  shopkeeper: "shopkeeper",
  owner: "owner",
  manager: "manager",
  medic: "medic",
  nurse: "nurse",
  courier: "courier",
  receptionist: "receptionist",
};

const ROLE_ALTERNATION = Object.keys(ROLE_WORDS).join("|");

/**
 * Capitalised words that are not a person's name: how sentences open, and the
 * gangs and places this city's prose keeps naming. The list is a guess about a
 * model's habits, not a lexicon; a name missed here is a false finding to add
 * to it, and the report quotes enough to see why.
 */
const NOT_A_NAME = new Set(
  (
    "The A An He She They It His Her Their You Your Down Near Over Two One Three Behind Beside " +
    "Tyger Tygers Claws Night City Japantown Little China Combat Zone Watson Kabuki Arasaka " +
    "Militech Kang Tao Biotechnica Trauma Team Maelstrom Valentino Valentinos Voodoo Boys Kimen " +
    "Unless Which What This That There These Those Here Maybe Perhaps Someone Anyone Nobody Everyone " +
    "Nothing Something Most Some All Then When While After Before Because Still Never Going Since " +
    "Not Now But And Yes No On In At For Like If So As Just Who Why How " +
    "Gumi Wraith Wraiths Sixth Street Nomad Nomads Edgerunner Edgerunners"
  ).split(" "),
);

/** A person's name bound to the job the prose gave them, and where it said so. */
type Binding = { name: string; role: string; quote: string };

/**
 * Who this turn's prose calls what. Three shapes, all of them the narrator
 * pinning a name to a job: "Kenji, the bartender", "the bartender, Kenji,", and
 * a line of speech that gives a name ("Name's Kenji") set against the nearest
 * job named before it.
 */
export function namedPeople(text: string): Binding[] {
  const out: Binding[] = [];
  const name = "([A-Z][a-z]{2,})";
  const role = `(${ROLE_ALTERNATION})`;
  const add = (n: string, r: string, quote: string) => {
    if (!NOT_A_NAME.has(n)) out.push({ name: n, role: ROLE_WORDS[r.toLowerCase()]!, quote });
  };
  for (const m of text.matchAll(new RegExp(`${name}, (?:the|a|an|another) ${role}\\b`, "gi"))) {
    if (/^[A-Z]/.test(m[1]!)) add(m[1]!, m[2]!, m[0]);
  }
  for (const m of text.matchAll(
    new RegExp(`\\b[Tt]he ${role}, ${name}(?=[,.;:!?]|\\s(?:said|says|nods|shrugs))`, "g"),
  )) {
    add(m[2]!, m[1]!, m[0]);
  }
  const jobBefore = new RegExp(`\\b(?:the|a) ${role}\\b`, "gi");
  for (const m of text.matchAll(
    /(?:\b[Nn]ame['’]?s|\b[Nn]ame is|\b[Cc]all me|\bthey call me|\bI['’]?m|\bI am) ([A-Z][a-z]{2,})/g,
  )) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 400), m.index);
    const jobs = [...before.matchAll(jobBefore)];
    const last = jobs[jobs.length - 1];
    if (last) add(m[1]!, last[1]!, m[0]);
  }
  return out;
}

/**
 * Names the prose gives to whoever is speaking or acting, in the two shapes a
 * model reaches for once a person has been introduced: the name opening a
 * sentence with a verb after it ("Kenji stares at you"), and a name alone in
 * quotation marks, which is what a person says when asked who they are.
 * Meaningful only when the scene has one person the player is dealing with, so
 * it is used only for a session that says so (`interlocutor`).
 */
export function speakerNames(text: string): { name: string; quote: string; answered: boolean }[] {
  const out: { name: string; quote: string; answered: boolean }[] = [];
  const keep = (name: string, quote: string, answered = false) => {
    if (!NOT_A_NAME.has(name) && !name.endsWith("ing")) out.push({ name, quote, answered });
  };
  for (const m of text.matchAll(
    /(?:^|[.!?…]["'’”]?\s+|\n\s*)([A-Z][a-z]{2,})\s+(?:[a-z]+s|[a-z]+ed)\b/g,
  )) {
    keep(m[1]!, m[0].trim());
  }
  for (const m of text.matchAll(/["'“‘]([A-Z][a-z]{2,})[,.!]["'”’]/g)) keep(m[1]!, m[0], true);
  return out;
}

/** What a session may tell a check about its scene. */
export type SessionScene = {
  /** The one job the player is dealing with the whole scene ("bartender"), when there is one. */
  interlocutor?: string | undefined;
};

export const keepsItsPeople: SessionCheck = {
  id: "keeps-its-people",
  title: "kept a person the name and the job the scene gave them",
  source:
    'PRODUCT.md: "The player is reading more than they are deciding" is only bearable if the people in it stay the people they were; a barman who is Kenji in turn two and Hiro in turn five is the fiction contradicting itself.',
  run(turns, scene) {
    const findings: (Finding & { turn: number })[] = [];
    const seat = scene?.interlocutor ? ROLE_WORDS[scene.interlocutor] : undefined;
    // First turn each job was given a name, and each name a job.
    const roleName = new Map<string, { name: string; turn: number }>();
    const nameRole = new Map<string, { role: string; turn: number }>();
    for (const [index, turn] of turns.entries()) {
      for (const b of namedPeople(turn.narration)) {
        const t = index + 1;
        const seenName = roleName.get(b.role);
        if (!seenName) roleName.set(b.role, { name: b.name, turn: t });
        else if (seenName.name !== b.name) {
          findings.push({
            turn: t,
            quote: b.quote,
            note: `the ${b.role} was ${seenName.name} in turn ${seenName.turn}`,
          });
        }
        const seenRole = nameRole.get(b.name);
        if (!seenRole) nameRole.set(b.name, { role: b.role, turn: t });
        else if (seenRole.role !== b.role) {
          findings.push({
            turn: t,
            quote: b.quote,
            note: `${b.name} was the ${seenRole.role} in turn ${seenRole.turn}`,
          });
        }
      }
    }
    if (seat) findings.push(...interlocutorRenamed(turns, seat));
    return findings;
  },
};

/**
 * A scene with one person the player deals with, and whether that person kept
 * one name. Who acts is not who is being asked: an owner discussed in turn three
 * ("Sato gets a cut") opens a sentence with a verb too, so a name seen once does
 * not count as the interlocutor changing. Two things do. The name most turns
 * open on is taken as theirs, and then:
 *   - a name given alone in quotes, the answer to "who are you", that is not it;
 *   - another name that opens sentences in at least two turns, none of which the
 *     first name is in: someone else has taken the seat.
 */
function interlocutorRenamed(turns: CheckableTurn[], seat: string): (Finding & { turn: number })[] {
  const acting = new Map<string, number[]>();
  const answers: { name: string; turn: number; quote: string }[] = [];
  for (const [index, turn] of turns.entries()) {
    for (const n of speakerNames(turn.narration)) {
      if (n.answered) answers.push({ name: n.name, turn: index + 1, quote: n.quote });
      else if (!acting.get(n.name)?.includes(index + 1)) {
        acting.set(n.name, [...(acting.get(n.name) ?? []), index + 1]);
      }
    }
  }
  const ranked = [...acting.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[1][0]! - b[1][0]!,
  );
  const own = ranked[0];
  if (!own) return [];
  const [ownName, ownTurns] = own;
  const findings: (Finding & { turn: number })[] = [];
  for (const a of answers) {
    if (a.name !== ownName) {
      findings.push({
        turn: a.turn,
        quote: a.quote,
        note: `the ${seat} was ${ownName} in turn ${ownTurns[0]}`,
      });
    }
  }
  for (const [name, at] of ranked.slice(1)) {
    if (at.length >= 2 && !at.some((t) => ownTurns.includes(t))) {
      findings.push({
        turn: at[1]!,
        quote: name,
        note: `the ${seat} was ${ownName} in turn ${ownTurns[0]}`,
      });
    }
  }
  return findings;
}

export const ALL_SESSION_CHECKS: SessionCheck[] = [doesNotRepeatItself, keepsItsPeople];
