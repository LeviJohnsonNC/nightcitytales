/**
 * Presentation-only formatting for long rules lore text. No text is added,
 * removed, or reworded — the source string from the rules data is split into
 * sentences and regrouped into paragraphs, and terms already present in the
 * data (the Role name, its Role Ability name) are marked for emphasis.
 */

export type LoreSegment = { text: string; emphasis: boolean };

/** Split a block of prose into sentences, keeping punctuation and quotes. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?]["”']?)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Group sentences into paragraphs of at most `per` sentences. */
export function loreParagraphs(text: string, per = 3): string[] {
  const parts = sentences(text);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += per) {
    out.push(parts.slice(i, i + per).join(" "));
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split a paragraph into segments, marking the given terms for emphasis.
 * Terms must come from the rules data; nothing is invented here.
 */
export function emphasizeTerms(paragraph: string, terms: string[]): LoreSegment[] {
  const cleaned = terms.map((t) => t.trim()).filter((t) => t.length > 2);
  if (cleaned.length === 0) return [{ text: paragraph, emphasis: false }];

  const alternation = cleaned.map(escapeRegExp).join("|");
  const splitter = new RegExp(`(${alternation})`, "gi");
  const exact = new RegExp(`^(${alternation})$`, "i");
  return paragraph
    .split(splitter)
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => ({ text: chunk, emphasis: exact.test(chunk) }));
}

