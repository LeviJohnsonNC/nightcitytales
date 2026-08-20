import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  isDiceSoundEnabled,
  onDiceSoundChange,
  playSettleSound,
  setDiceSoundEnabled,
} from "./diceSound";

/** Small speaker toggle for dice audio. Off by default, persisted. */
export function DiceSoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(false);

  // Read the persisted value on the client only (avoids SSR mismatch).
  useEffect(() => {
    setOn(isDiceSoundEnabled());
    return onDiceSoundChange(setOn);
  }, []);

  function toggle() {
    const next = !on;
    setDiceSoundEnabled(next);
    if (next) playSettleSound(); // confirmation blip
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={on}
      aria-label={on ? "Dice sound on" : "Dice sound off"}
      title={on ? "Dice sound on" : "Dice sound off"}
      className={cn(
        "grid size-8 place-items-center border transition-colors",
        on
          ? "border-cool/60 text-cool"
          : "border-hairline text-text-dim hover:border-cool/50 hover:text-cool",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
        <path
          d="M4 9v6h4l5 4V5L8 9H4z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {on ? (
          <path
            d="M16.5 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        ) : (
          <path d="M17 9l4 6M21 9l-4 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
