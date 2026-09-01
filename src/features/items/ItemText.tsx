/**
 * Prose with the gear catalog wired up. Any canonical item name inside the text
 * becomes a clickable catalog link; everything else renders untouched.
 * Mirrors NpcText/PlaceText, and is the last link in that chain.
 */
import { Fragment, useMemo } from "react";
import { ITEM_MATCH_KEYS } from "./itemDirectory";
import { ItemName } from "./ItemName";

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['\u2018\u2019]/g, "['\u2018\u2019]");
}

const PATTERN = new RegExp(
  ITEM_MATCH_KEYS.map((k) => {
    const body = escape(k);
    const left = /^\w/.test(k) ? "\\b" : "";
    const right = /\w$/.test(k) ? "\\b" : "";
    return `${left}${body}${right}`;
  }).join("|"),
  "gi",
);

export function ItemText({ text }: { text: string }) {
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
          <ItemName key={i} name={p.match}>
            {p.match}
          </ItemName>
        ),
      )}
    </>
  );
}
