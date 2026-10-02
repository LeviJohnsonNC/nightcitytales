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
import { Button } from "@/components/ui/button";

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
    <section className="space-y-2 border border-accent/60 bg-accent/5 p-3 text-sm">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
        Where you could go from here
      </p>
      <p>
        Every Skill, your Role, the chrome, and who in this city respects you has a next step and a
        price. Jobs and the days between them earn the points. See what is within reach, and pin up
        to three things to work toward.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            close();
            onShow();
          }}
        >
          Show me
        </Button>
        <Button size="sm" variant="ghost" onClick={close}>
          Got it
        </Button>
      </div>
    </section>
  );
}
