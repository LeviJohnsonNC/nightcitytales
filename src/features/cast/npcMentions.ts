/**
 * Where the cast are named in a piece of prose.
 *
 * One pattern, two readers: `NpcText` makes each mention a link, and the scene's
 * "who is here" row (`life/sceneFaces.ts`) asks who the current paragraph is
 * about. They must agree on what counts as a mention, so the matching lives here
 * and neither keeps a copy.
 */
import { NPC_MATCH_KEYS, findNpc, type NpcEntry } from "./npcDirectory";

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest key first so full names beat nicknames. Boundaries are added only
// where the key actually begins/ends with a word character.
const PATTERN = new RegExp(
  NPC_MATCH_KEYS.map((k) => {
    const body = escape(k);
    const left = /^\w/.test(k) ? "\\b" : "";
    const right = /\w$/.test(k) ? "\\b" : "";
    return `${left}${body}${right}`;
  }).join("|"),
  "gi",
);

/** The text cut into plain runs and the names found in it, in order. */
export function splitNpcMentions(text: string): Array<string | { match: string }> {
  const out: Array<string | { match: string }> = [];
  let last = 0;
  PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATTERN.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ match: m[0] });
    last = m.index + m[0].length;
    if (m[0].length === 0) PATTERN.lastIndex++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The people a passage names, each once, in the order they first appear. */
export function npcsNamedIn(text: string): NpcEntry[] {
  const seen = new Set<string>();
  const out: NpcEntry[] = [];
  for (const part of splitNpcMentions(text)) {
    if (typeof part === "string") continue;
    const npc = findNpc(part.match);
    if (npc && !seen.has(npc.id)) {
      seen.add(npc.id);
      out.push(npc);
    }
  }
  return out;
}
