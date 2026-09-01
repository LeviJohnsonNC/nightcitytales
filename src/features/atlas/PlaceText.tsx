/**
 * Prose with the map wired up. Any canonical district or location name inside
 * the text becomes a clickable atlas link; everything else renders untouched.
 * Mirrors NpcText.
 */
import { Fragment, useMemo } from "react";
import { PLACE_MATCH_KEYS } from "@/engine";
import { PlaceName } from "./PlaceName";

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <PlaceName key={i} name={p.match}>
            {p.match}
          </PlaceName>
        ),
      )}
    </>
  );
}
