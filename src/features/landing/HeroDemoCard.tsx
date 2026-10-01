/**
 * A scene from the game, over the key art: the Life screen's own character
 * card with a few lines of the Game Master under it, typing, while the numbers
 * move as the story does. Decorative and invented (`heroDemo.ts`); the card is
 * the real one, so it cannot drift from what the game looks like.
 */
import { useEffect, useState } from "react";
import { CharacterCard } from "@/features/life/hud/CharacterCard";
import { prefersReducedMotion } from "@/features/opening/descent/descentDevice";
import { DEMO_MAX, DEMO_START, demoFrame, stillFrame, type DemoFrame } from "./heroDemo";

/** How often the scene is redrawn: fast enough to type smoothly, slow enough to cost nothing. */
const TICK_MS = 60;

export function HeroDemoCard({ className }: { className?: string | undefined }) {
  const [frame, setFrame] = useState<DemoFrame>(stillFrame());

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setFrame(demoFrame(performance.now() - start));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={className}
      role="img"
      aria-label="A scene from the game: a character's health and humanity, and the Game Master narrating"
    >
      <div aria-hidden className="space-y-2">
        <CharacterCard
          name="Sliver"
          role="lawman"
          hp={{ current: frame.hp, max: DEMO_MAX.hp }}
          humanity={{ current: frame.humanity, max: DEMO_MAX.humanity }}
          luck={{ left: DEMO_START.luck, max: DEMO_MAX.luck }}
          wound={frame.hp < 20 ? "serious" : frame.hp < DEMO_MAX.hp ? "light" : "none"}
        />
        <div className="min-h-[5.25rem] border border-hairline bg-surface/85 p-3 backdrop-blur-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-cyan">
            Game Master
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-text">
            {frame.text}
            {frame.typing && (
              <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-ember" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
