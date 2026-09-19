/**
 * What the game says while it is thinking.
 *
 * A Life turn takes a few seconds and a player sees this line several hundred
 * times in a session, so one fixed sentence stops being atmosphere and starts
 * being a spinner with words on it. The pool below is picked from per turn and
 * filtered by where and when the character is standing, which is the cheap
 * version of the same trick the narration uses: the wait says something true
 * about the city rather than something generic about the software.
 *
 * Pure on purpose — no React, no clock reads of its own. The caller passes the
 * context and a seed, the same line comes back every time, and the test can say
 * so. `LifeScreen` seeds it from the turn count, so the line changes when the
 * turn does and never mid-wait.
 */

/** Which accent a line is lit in. Three, so consecutive waits read differently. */
export type TurnHue = "ember" | "cool" | "purple";

export type TurnLine = {
  text: string;
  hue: TurnHue;
};

/** Everything a line is allowed to know about the moment it is covering. */
export type TurnContext = {
  /** From `partOfDay(clock.minute)`. */
  dayPart: "night" | "morning" | "afternoon" | "evening";
  /** The district the character is in, in its printed name. */
  districtName?: string | undefined;
  /** The venue or landmark they are standing in, when they are in one. */
  placeName?: string | undefined;
  /** Whether that district is a Combat Zone. Changes what the wait sounds like. */
  combatZone?: boolean | undefined;
};

type Candidate = {
  /** `{place}` and `{district}` are filled from the context. */
  text: string;
  hue: TurnHue;
  /** When present, the line is only offered at these parts of the day. */
  when?: TurnContext["dayPart"][];
  /** The context fields the line's text needs before it can be offered. */
  needs?: ("place" | "district")[];
  /** Offered only inside, or only outside, a Combat Zone. */
  zone?: "combat" | "civil";
};

/**
 * The pool. Every line is present tense and about the city rather than about
 * the machine — "compiling", "thinking" and "loading" are the exact words this
 * screen is trying not to say.
 */
const LINES: Candidate[] = [
  { text: "Night City turns…", hue: "ember" },
  { text: "The city takes a breath…", hue: "cool" },
  { text: "Somewhere a deal is being made…", hue: "purple" },
  { text: "The wire is warming up…", hue: "cool" },
  { text: "Waiting on the street to answer…", hue: "ember" },
  { text: "The odds are rearranging themselves…", hue: "purple" },
  { text: "Something is deciding whether to happen…", hue: "ember" },
  { text: "Chrome cooling, thoughts catching up…", hue: "cool" },
  { text: "The traffic finds a different route…", hue: "purple" },
  { text: "A dozen scanners, none of them yours…", hue: "cool" },
  { text: "Money changes hands three blocks over…", hue: "ember" },
  { text: "The night is drafting its reply…", hue: "purple" },

  { text: "{place} is deciding what you are…", hue: "ember", needs: ["place"] },
  { text: "The room reads you back…", hue: "purple", needs: ["place"] },
  { text: "{district} makes up its mind…", hue: "cool", needs: ["district"] },
  { text: "Word travels {district} faster than you do…", hue: "ember", needs: ["district"] },

  { text: "The streetlights buzz over an empty block…", hue: "cool", when: ["night"] },
  { text: "Nothing good is awake yet…", hue: "purple", when: ["night"] },
  { text: "Last call somewhere, first shift somewhere else…", hue: "ember", when: ["night"] },
  { text: "The city scrapes itself off the pavement…", hue: "cool", when: ["morning"] },
  { text: "Shutters going up, prices going with them…", hue: "ember", when: ["morning"] },
  { text: "Heat coming off the concrete…", hue: "ember", when: ["afternoon"] },
  { text: "The day shift counts what is left…", hue: "purple", when: ["afternoon"] },
  { text: "The signs come on one street at a time…", hue: "ember", when: ["evening"] },
  { text: "Everyone is going somewhere at once…", hue: "cool", when: ["evening"] },

  { text: "Nobody here calls anybody…", hue: "purple", zone: "combat" },
  { text: "Counting exits out of habit…", hue: "ember", zone: "combat" },
  { text: "The quiet is doing something…", hue: "cool", zone: "combat" },
  { text: "Someone's paperwork catches up with someone…", hue: "cool", zone: "civil" },
  { text: "The city bills you for standing still…", hue: "purple", zone: "civil" },
];

function offered(line: Candidate, context: TurnContext): boolean {
  if (line.when && !line.when.includes(context.dayPart)) return false;
  if (line.zone === "combat" && !context.combatZone) return false;
  if (line.zone === "civil" && context.combatZone) return false;
  for (const need of line.needs ?? []) {
    if (need === "place" && !context.placeName) return false;
    if (need === "district" && !context.districtName) return false;
  }
  return true;
}

function fill(text: string, context: TurnContext): string {
  return text
    .replace("{place}", context.placeName ?? "")
    .replace("{district}", context.districtName ?? "");
}

/**
 * The line for one wait.
 *
 * `seed` is any integer that changes per turn; the same seed and context always
 * give the same line, which is what keeps the text still while the turn runs
 * and what lets the test assert on it.
 */
export function turnLine(context: TurnContext, seed: number): TurnLine {
  const pool = LINES.filter((line) => offered(line, context));
  // The first line is unconditional, so the pool is never empty; belt and braces.
  const candidates = pool.length ? pool : [LINES[0]!];
  const index = Math.abs(Math.trunc(seed)) % candidates.length;
  const picked = candidates[index]!;
  return { text: fill(picked.text, context), hue: picked.hue };
}

/** Every line, for the test that checks the pool itself stays well formed. */
export const TURN_LINE_POOL: readonly Candidate[] = LINES;
