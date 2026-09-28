import { useEffect, useState } from "react";
import { Music, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isMusicBlocked,
  isMusicEnabled,
  justUnblocked,
  onMusicBlocked,
  onMusicChange,
  setMusicEnabled,
} from "./musicDirector";
import "../interview.css";

/**
 * The soundtrack's on/off switch. On by default; remembered.
 *
 * While the browser is holding the music back until the page is touched, the
 * switch pulses, so a silent page says why. The touch that starts it is often
 * a click on this switch, and that click must not then turn the music off.
 */
export function MusicToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setOn(isMusicEnabled());
    setBlocked(isMusicBlocked());
    const offChange = onMusicChange(setOn);
    const offBlocked = onMusicBlocked(setBlocked);
    return () => {
      offChange();
      offBlocked();
    };
  }, []);

  const waiting = on && blocked;
  const label = waiting ? "Tap for music" : on ? "Music on" : "Music off";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={() => {
        if (on && justUnblocked()) return;
        setMusicEnabled(!on);
      }}
      className={cn(
        "grid size-8 place-items-center border transition-colors",
        on
          ? "border-accent/60 text-accent"
          : "border-hairline text-text-dim hover:border-accent/50 hover:text-accent",
        waiting && "cg-beckon",
        className,
      )}
    >
      {on ? <Music className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
    </button>
  );
}
