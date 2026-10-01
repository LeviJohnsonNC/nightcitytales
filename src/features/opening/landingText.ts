/**
 * The prose arriving at the pace it is read, a paragraph at a time.
 *
 * Pure: how much of each paragraph is showing at a moment, so the typing can be
 * tested without a clock and a skip is just a very large number. The pause
 * between paragraphs is counted in characters' worth of time, so it scales
 * with the speed rather than being a second timer.
 */

/** Characters a second. Quicker than speech, slower than skimming. */
export const TYPE_CPS = 58;
/** The breath between one paragraph and the next. */
export const PARAGRAPH_PAUSE_MS = 380;

/** The time the whole of `paragraphs` takes to type, pauses included. */
export function typingDuration(paragraphs: string[], cps = TYPE_CPS): number {
  const chars = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const pauses = Math.max(0, paragraphs.length - 1) * PARAGRAPH_PAUSE_MS;
  return (chars / cps) * 1000 + pauses;
}

/** How many characters of each paragraph are showing `ms` into the typing. */
export function revealed(paragraphs: string[], ms: number, cps = TYPE_CPS): number[] {
  const counts: number[] = [];
  let clock = Math.max(0, ms);
  for (const paragraph of paragraphs) {
    const needed = (paragraph.length / cps) * 1000;
    if (clock >= needed) {
      counts.push(paragraph.length);
      clock -= needed + PARAGRAPH_PAUSE_MS;
    } else {
      counts.push(Math.max(0, Math.floor((clock / 1000) * cps)));
      clock = -1;
    }
    if (clock < 0) clock = -1e9;
  }
  return counts;
}

/** Whether every paragraph is fully showing. */
export function isRevealed(paragraphs: string[], counts: number[]): boolean {
  return paragraphs.every((p, i) => (counts[i] ?? 0) >= p.length);
}
