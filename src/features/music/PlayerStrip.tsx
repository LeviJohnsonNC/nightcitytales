import { useMinWidth } from "@/hooks/use-min-width";
import { NCAmp } from "./ncamp/NCAmp";

/** Where a phone's layout ends and the desktop's begins; the same `lg` the game screens use. */
export const DESKTOP_PX = 1024;

/**
 * NCAmp's strip, for the desktop game screens: a row under the campaign header,
 * at the right where the creator keeps it. A phone has its own, in the sticky
 * status bar, and exactly one of the two is ever mounted.
 */
export function PlayerStrip() {
  const desktop = useMinWidth(DESKTOP_PX);
  if (!desktop) return null;
  return (
    <div className="mt-2 flex justify-end" data-player-strip>
      <NCAmp />
    </div>
  );
}
