/**
 * Prose with the map wired up. Any canonical district or location name inside
 * the text becomes a clickable atlas link; everything else renders untouched.
 * Mirrors NpcText.
 */
import { Fragment, useMemo } from "react";
import { PLACE_MATCH_KEYS } from "@/engine";
import { ItemText } from "@/features/items/ItemText";
import { PlaceName } from "./PlaceName";

// Curly and straight apostrophes are interchangeable: the atlas prints "Fiddler’s
// Green" while the model usually writes "Fiddler's Green".
function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['\u2018\u2019]/g, "['\u2018\u2019]");
}

// Longest key first, so "Night City Firestation #2" wins over "Night City".
const PATTERN = new RegExp(
  PLACE_MATCH_KEYS.map((k) => {
    const body = escape(k);
    const left = /^\w/.test(k) ? "\\b" : "";
    const right = /\w$/.test(k) ? "\\b" : "";
    return `${left}${body}${right}`;
  }).join("|"),
  "gi",
);

export function PlaceText({ text }: { text: string }) {
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
          <Fragment key={i}>
            <ItemText text={p} />
          </Fragment>
        ) : (
          <PlaceName key={i} name={p.match}>
            {p.match}
          </PlaceName>
        ),
      )}
    </>
  );
}
