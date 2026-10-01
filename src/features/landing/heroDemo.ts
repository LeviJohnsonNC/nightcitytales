/**
 * The scene the landing hero plays beside the runner: a few lines of the Game
 * Master typing, and the numbers on a character card moving as the story does.
 *
 * Invented, and says so: nobody's character, no account, no call. It is a pure
 * function of time so the card can be a loop and a test can read any moment of
 * it. What it shows is only what the real game does — a line of narration, a
 * wound taking HP, chrome costing Humanity.
 */

export type DemoBeat = {
  text: string;
  /** Set a vital to this once the line has finished typing. */
  then?: { hp?: number; humanity?: number };
};

export const DEMO_START = { hp: 40, humanity: 46, luck: 4 } as const;
export const DEMO_MAX = { hp: 40, humanity: 60, luck: 6 } as const;

export const DEMO_BEATS: readonly DemoBeat[] = [
  { text: "The landlord's second notice is under the door. Kit has called twice." },
  {
    text: "Your ripperdoc has something interesting for sale. Cash up front, no questions.",
    then: { humanity: 43 },
  },
  {
    text: "Somebody is waiting in the stairwell. You hear the safety click.",
    then: { hp: 31 },
  },
  { text: "You make it to the street, bleeding and alive. The rent can wait." },
];

/** Characters a second the GM types at: a reading pace. */
export const TYPE_CPS = 34;
/** How long a finished line stays up, and the pause before the next. */
export const HOLD_MS = 3000;
export const GAP_MS = 500;

type Slot = { start: number; typeEnd: number; end: number; beat: DemoBeat };

function schedule(): { slots: Slot[]; period: number } {
  let at = 0;
  const slots = DEMO_BEATS.map((beat) => {
    const typeMs = Math.round((beat.text.length / TYPE_CPS) * 1000);
    const slot = { start: at, typeEnd: at + typeMs, end: at + typeMs + HOLD_MS + GAP_MS, beat };
    at = slot.end;
    return slot;
  });
  return { slots, period: at };
}

const { slots: SLOTS, period: PERIOD } = schedule();

/** One full run of the scene, in ms. */
export const DEMO_PERIOD_MS = PERIOD;

export type DemoFrame = {
  /** The part of the current line typed so far. */
  text: string;
  /** Whether the GM is still typing it. */
  typing: boolean;
  hp: number;
  humanity: number;
};

/** The scene at a moment, looping. Time before the first line is an empty page. */
export function demoFrame(ms: number): DemoFrame {
  const t = ((ms % PERIOD) + PERIOD) % PERIOD;
  let hp: number = DEMO_START.hp;
  let humanity: number = DEMO_START.humanity;
  let shown = "";
  let typing = false;
  for (const slot of SLOTS) {
    if (t >= slot.typeEnd) {
      hp = slot.beat.then?.hp ?? hp;
      humanity = slot.beat.then?.humanity ?? humanity;
    }
    if (t >= slot.start && t < slot.end) {
      const typed = Math.min(
        slot.beat.text.length,
        Math.floor(((t - slot.start) / 1000) * TYPE_CPS),
      );
      // The line clears for the gap before the next one.
      shown = t >= slot.end - GAP_MS ? "" : slot.beat.text.slice(0, typed);
      typing = t < slot.typeEnd;
    }
  }
  return { text: shown, typing, hp, humanity };
}

/** What someone who asked for less motion sees: the first line, whole, and the starting numbers. */
export function stillFrame(): DemoFrame {
  return {
    text: DEMO_BEATS[0]!.text,
    typing: false,
    hp: DEMO_START.hp,
    humanity: DEMO_START.humanity,
  };
}
