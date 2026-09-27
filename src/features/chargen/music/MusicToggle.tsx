import { useEffect, useState } from "react";
import { Music, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { isMusicEnabled, onMusicChange, setMusicEnabled } from "./musicDirector";

/** The soundtrack's on/off switch. On by default; remembered. */
export function MusicToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(isMusicEnabled());
    return onMusicChange(setOn);
  }, []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Music on" : "Music off"}
      title={on ? "Music on" : "Music off"}
      onClick={() => setMusicEnabled(!on)}
      className={cn(
        "grid size-8 place-items-center border transition-colors",
        on
          ? "border-accent/60 text-accent"
          : "border-hairline text-text-dim hover:border-accent/50 hover:text-accent",
        className,
      )}
    >
      {on ? <Music className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
    </button>
  );
}
