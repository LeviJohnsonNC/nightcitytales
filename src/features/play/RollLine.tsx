/**
 * One roll in the log.
 *
 * A roll the player pressed shows its whole formula, as it always has. A roll
 * the engine made by itself (engine/autoRoll.ts) shows one short line marked
 * "auto", and opens to the full formula — the player should know a die was
 * thrown for them and what it said, without reading the arithmetic every time.
 */
import type { CampaignEvent } from "@/lib/backend";
import { readAutoRoll } from "@/features/campaign/skillCheckLog";

export function RollLine({ event, text }: { event: CampaignEvent; text: string }) {
  const auto = readAutoRoll(event);
  if (!auto) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        <span className="text-accent">◆</span> {text}
      </p>
    );
  }
  return (
    <details className="font-mono text-xs text-muted-foreground">
      <summary className="cursor-pointer list-none">
        <span className="text-accent">◇</span> {auto.headline}
      </summary>
      <p className="mt-1 pl-4 text-muted-foreground/80">{auto.detail}</p>
    </details>
  );
}
