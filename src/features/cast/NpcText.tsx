/**
 * Prose with the cast wired up. Any known name inside the text becomes a
 * clickable dossier link, and whatever is left runs through PlaceText so
 * canonical Night City districts and locations link to the atlas too.
 */
import { Fragment, useMemo } from "react";
import { splitNpcMentions } from "./npcMentions";
import { NpcName } from "./NpcName";
import { PlaceText } from "@/features/atlas/PlaceText";

export function NpcText({ text }: { text: string }) {
  const parts = useMemo(() => splitNpcMentions(text), [text]);

  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <Fragment key={i}>
            <PlaceText text={p} />
          </Fragment>
        ) : (
          <NpcName key={i} name={p.match} card>
            {p.match}
          </NpcName>
        ),
      )}
    </>
  );
}
