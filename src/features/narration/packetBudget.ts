/**
 * How much of each thing reaches the model.
 *
 * WHY THIS EXISTS. Nothing counted. No tokenizer, no `maxTokens`, no budget of
 * any kind — the packet was whatever the renderers happened to emit, and the
 * only bounds were ad-hoc `slice()` calls scattered between the renderers and
 * their callers. Some lists were capped in one place, some in the other, and
 * several were not capped at all: the kit a character carries, the people in
 * the room, what they have learned about somewhere, the objectives still open.
 * Each of those grows with play, so the packet grew with play, and nothing
 * anywhere would have said so.
 *
 * Measured before any of this was written, on a Job turn with the largest
 * dossier, thirty capability lines and ten people present:
 *
 *   system prompt   31,004 chars
 *   bare packet      2,677
 *   + place          7,539   (the dossier alone was 4,962)
 *   + capabilities   1,741
 *   + people         2,405
 *   + chronicle        847
 *   ------------------------
 *   total           46,213 chars, about 11,500 tokens
 *
 * So the system prompt is two thirds of it and is NOT cut here: which rules to
 * drop is a quality decision, and Slice 0 deliberately ADDED rules that both
 * narrators were missing. What is cut here is the part that grows on its own.
 *
 * The numbers are guesses in the same sense the location layer's pacing
 * numbers are: they bound the thing, and play will say whether they bound it in
 * the right place. They live here, together, so that tuning one is a diff to
 * one file rather than a hunt through two renderers and two ops modules.
 */

/**
 * The most of each list the model is shown.
 *
 * Ordered by how fast the thing grows in play, which is also roughly how likely
 * each is to be the one that matters.
 */
export const PACKET_BUDGET = {
  /** Weapons, kit and chrome. Grows every time they buy anything. */
  capabilities: 24,
  /** People in the room, and what the player has worked out about each. */
  npcsPresent: 8,
  npcKnown: 4,
  /** What standing here has taught them. Grows with every visit. */
  placeKnown: 8,
  /** Objectives still open. A mission can author many; few are live at once. */
  objectives: 8,
  /** Venues and districts within reach. Bounded by the atlas, capped anyway. */
  nearby: 8,
  neighbours: 8,
  /**
   * People the character knows, and other situations still live.
   *
   * These two were already capped, by a bare `.slice()` in the Life renderer.
   * They are named here with the rest so that every bound on the packet is one
   * file rather than a hunt — which is how `nearby` came to be capped at the
   * two ops call sites and nowhere else, and so applied to those two callers
   * and to nobody who might write a third.
   */
  people: 10,
  otherSituations: 6,
  /** Prose about where they are standing, in characters, not lines. */
  dossierChars: 2400,
} as const;

/**
 * Take the first `max` of a list.
 *
 * A named function rather than a bare `.slice()` at each site, so that the
 * budget and the cut are the same decision in the same place. Every list the
 * renderers iterate goes through this or through an explicit slice with a
 * comment saying why not.
 */
export function withinBudget<T>(items: readonly T[], max: number): T[] {
  return items.length <= max ? [...items] : items.slice(0, max);
}

/**
 * Trim a dossier to fit, cutting whole paragraphs from the end.
 *
 * Paragraphs rather than characters because a dossier is prose, and a cut
 * mid-sentence reads to the model as a fact that trails off. Cutting from the
 * END is right for what these contain: they open on what the place is, who runs
 * it and what it looks like — the part the prompt actually asks for — and close
 * on what the place would be useful to a runner, which is the part the prompt
 * already spends most of a paragraph telling the model to ignore.
 *
 * The first paragraph is always kept whole, however long it is. A place with
 * nothing said about it is worse than a place described at length: the fault
 * this canon exists to fix was a narrator inventing a greasy noodle counter for
 * an automated conveyor-belt sushi place, and half a dossier still prevents it.
 *
 * At 2,400 this touches 37 of 196 dossiers and reduces none of them to a single
 * paragraph. The point is the bound rather than the saving — the largest was
 * 4,962 characters and nothing stopped the next one being fifteen thousand.
 *
 * Familiarity is deliberately NOT a factor. Scaling the budget by how well the
 * character knows the place is tempting and would be wrong here: the prompt
 * already modulates that, in words, telling the narrator to spend almost no
 * description on a place they know cold. Doing it twice, in two mechanisms,
 * is the second source of truth this project refuses everywhere else.
 */
export function clipDossier(text: string, budget: number = PACKET_BUDGET.dossierChars): string {
  if (text.length <= budget) return text;
  const paragraphs = text.split(/\n{2,}/);
  let kept = paragraphs[0] ?? text;
  for (const paragraph of paragraphs.slice(1)) {
    if (kept.length + 2 + paragraph.length > budget) break;
    kept += `\n\n${paragraph}`;
  }
  return kept;
}
