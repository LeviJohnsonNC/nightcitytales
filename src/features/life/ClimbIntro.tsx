/**
 * The day-one pointer at Within reach.
 *
 * A new character starts with nothing banked and nothing pinned, and Within
 * reach is one tile among six. This says once what is there to climb and opens
 * it. It goes away for good when the player pins something or says they have
 * it; the dismissal is a per-viewer convenience kept in browser storage, so a
 * blocked or cleared store only means seeing it again.
 */
import { useState } from "react";

function storageKey(campaignId: string): string {
  return `nct:climb-intro:${campaignId}`;
}

function wasDismissed(campaignId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(campaignId)) === "1";
  } catch {
    return false;
  }
}

function dismiss(campaignId: string): void {
  try {
    window.localStorage.setItem(storageKey(campaignId), "1");
  } catch {
    // Nowhere to remember it: it will show again, which is harmless.
  }
}

export function ClimbIntro({
  campaignId,
  pinnedCount,
  onShow,
}: {
  campaignId: string;
  pinnedCount: number;
  onShow: () => void;
}) {
  const [hidden, setHidden] = useState(() => wasDismissed(campaignId));
  if (hidden || pinnedCount > 0) return null;
  const close = () => {
    dismiss(campaignId);
    setHidden(true);
  };
  return (
    <section className="life-ip-tip">
      <button
        type="button"
        onClick={() => {
          close();
          onShow();
        }}
      >
        See what’s within reach with IP
      </button>
      <button type="button" aria-label="Dismiss IP tip" onClick={close}>
        ×
      </button>
    </section>
  );
}
