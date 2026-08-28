/**
 * Prose with the cast wired up. Any known name inside the text becomes a
 * clickable dossier link; everything else renders untouched.
 */
import { Fragment, useMemo } from "react";
import { NPC_MATCH_KEYS } from "./npcDirectory";
import { NpcName } from "./NpcName";

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

export function NpcText({ text }: { text: string }) {
  const parts = useMemo(() => {
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
  }, [text]);

  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <NpcName key={i} name={p.match}>
            {p.match}
          </NpcName>
        ),
      )}
    </>
  );
}
