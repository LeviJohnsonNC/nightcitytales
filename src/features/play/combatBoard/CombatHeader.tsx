import type { ReactNode } from "react";
import { Radio, Volume2, VolumeX } from "lucide-react";
import { NightCityMark } from "@/components/brand/NightCityMark";
import type { useCombatFeedback } from "../useCombatFeedback";
import type { BoardArena } from "./boardTypes";

/** The combat screen's title bar: the fight's name, its tools and the sound controls. */
export function CombatHeader({
  title,
  objective,
  arena,
  tools,
  effects,
  setPanel,
}: {
  title: string | undefined;
  objective: string | undefined;
  arena: BoardArena;
  tools: ReactNode;
  effects: ReturnType<typeof useCombatFeedback>;
  setPanel: (panel: "journal" | "improvise" | null) => void;
}) {
  return (
    <header className="combat-header">
      <div className="combat-brand">
        <span className="combat-lockup">
          <NightCityMark />
          <span className="combat-eyebrow">Combat</span>
        </span>
        <h1>{title ?? "Contact"}</h1>
        <p>{objective ?? arena.label}</p>
      </div>
      <div className="combat-header-tools">
        {tools}
        <button
          className="combat-icon"
          aria-label={effects.muted ? "Unmute combat sounds" : "Mute combat sounds"}
          aria-pressed={effects.muted}
          onClick={effects.toggleMute}
        >
          {effects.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          className="combat-volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={effects.volume}
          onChange={(e) => effects.changeVolume(Number(e.target.value))}
          aria-label="Combat sound volume"
        />
        <button
          className="combat-icon"
          aria-label="Open combat journal"
          onClick={() => setPanel("journal")}
        >
          <Radio size={18} />
        </button>
      </div>
    </header>
  );
}
