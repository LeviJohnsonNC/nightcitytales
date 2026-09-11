import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** A single thin meter rail. Ratio is computed by the caller from stored values. */
function Rail({
  label,
  current,
  max,
  tone,
  delay,
}: {
  label: string;
  current: number | null | undefined;
  max: number | null | undefined;
  tone: "vital" | "humanity";
  delay: number;
}) {
  const known = typeof current === "number" && typeof max === "number" && max > 0;
  const ratio = known ? Math.max(0, Math.min(1, current / max)) : 0;
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setGrown(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-dim">
          {label}
        </span>
        <span className="num text-[12px] font-semibold tabular-nums text-text-muted">
          {known ? `${current} / ${max}` : "—"}
        </span>
      </div>
      <div className="mt-1.5 h-[3px] w-full overflow-hidden bg-hairline/60">
        <div
          className={cn(
            "h-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
            tone === "vital"
              ? "bg-[linear-gradient(90deg,var(--color-neon-pink),#ff87c2)]"
              : "bg-[linear-gradient(90deg,var(--color-neon-cyan),var(--color-neon-purple))]",
          )}
          style={{ width: `${(grown ? ratio : 0) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function CharacterStats({
  hpCurrent,
  hpMax,
  humanityCurrent,
  humanityMax,
}: {
  hpCurrent: number | null | undefined;
  hpMax: number | null | undefined;
  humanityCurrent: number | null | undefined;
  humanityMax: number | null | undefined;
}) {
  return (
    <div className="space-y-3">
      <Rail label="HP" current={hpCurrent} max={hpMax} tone="vital" delay={120} />
      <Rail
        label="Humanity"
        current={humanityCurrent}
        max={humanityMax}
        tone="humanity"
        delay={220}
      />
    </div>
  );
}
