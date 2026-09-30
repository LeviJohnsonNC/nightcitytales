/**
 * One STAT in the Complete Package point-buy.
 *
 * Its own card rather than `StatCard`, because it has a different job: the
 * sheet's card reads a STAT, this one is where a STAT is bought. So the number
 * is the largest thing on it, the seven pips say exactly where it sits on the
 * 2 to 8 scale, and the two buttons are one joined strip pinned to the bottom,
 * where a thumb expects them, instead of two small squares beside an icon.
 */
import { useEffect, useRef, useState } from "react";
import type { StatKey } from "@/engine";
import { cn } from "@/lib/utils";
import { InfoDot, StatInfoModal } from "./SheetInfo";
import { STAT_SCALE, statColor } from "./statBands";
import { STAT_ICONS } from "./statIcons";
import "./interview.css";

/** One pip per point on the scale, floor to ceiling. */
const PIPS = STAT_SCALE.max - STAT_SCALE.min + 1;

/**
 * A − or + that keeps going while it is held. The first press acts at once, so
 * a tap is one point; a hold waits a beat and then repeats. Keyboard presses
 * arrive as clicks with no pointer (`detail` 0) and act once, since the pointer
 * handlers never saw them.
 */
function StepButton({
  label,
  disabled,
  onStep,
  children,
}: {
  label: string;
  disabled: boolean;
  onStep: () => void;
  children: React.ReactNode;
}) {
  const delay = useRef<number | undefined>(undefined);
  const repeat = useRef<number | undefined>(undefined);
  const stop = () => {
    window.clearTimeout(delay.current);
    window.clearInterval(repeat.current);
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        "h-10 touch-manipulation select-none font-mono text-xl font-semibold text-text transition-colors",
        "bg-[color-mix(in_oklab,var(--color-ground)_45%,transparent)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary",
        // A button that cannot be pressed says so: faint, and no hover to promise otherwise.
        "disabled:cursor-not-allowed disabled:opacity-30",
        "enabled:hover:bg-[color-mix(in_oklab,var(--c)_22%,var(--color-ground))]",
        "enabled:active:bg-[color-mix(in_oklab,var(--c)_34%,var(--color-ground))]",
      )}
      onPointerDown={() => {
        if (disabled) return;
        onStep();
        stop();
        delay.current = window.setTimeout(() => {
          repeat.current = window.setInterval(onStep, 90);
        }, 380);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onBlur={stop}
      onClick={(e) => {
        if (e.detail === 0) onStep();
      }}
    >
      {children}
    </button>
  );
}

export function PointBuyCard({
  stat,
  value,
  roleId,
  canRaise,
  canLower,
  onStep,
  mark,
}: {
  stat: StatKey;
  value: number;
  roleId: string | null;
  canRaise: boolean;
  canLower: boolean;
  onStep: (delta: number) => void;
  /** Set when this STAT is the character's edge or weak spot. */
  mark: "edge" | "weak" | null;
}) {
  const [open, setOpen] = useState(false);
  const Icon = STAT_ICONS[stat];
  const color = statColor(value);
  const upper = stat.toUpperCase();
  const accent = mark === "weak" ? "var(--color-danger)" : color;

  return (
    <div
      className="relative flex min-h-[196px] flex-col overflow-hidden border bg-surface-raised transition-[border-color,box-shadow] duration-200"
      style={
        {
          "--c": color,
          borderColor: mark
            ? `color-mix(in oklab, ${accent} 70%, transparent)`
            : "var(--color-hairline)",
          boxShadow: mark ? `0 0 14px -5px ${accent}` : undefined,
          backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${color} 12%, transparent), transparent 55%)`,
        } as React.CSSProperties
      }
    >
      <div className="relative flex items-center gap-1.5 pl-3 pr-2.5 pt-2.5">
        <span className="font-mono text-[11px] tracking-[0.18em] text-text-dim">{upper}</span>
        <InfoDot label={`What is ${upper} good for?`} onClick={() => setOpen(true)} />
        {Icon && (
          <Icon
            aria-hidden
            className="ml-auto size-5"
            strokeWidth={1.75}
            style={{
              color,
              filter: `drop-shadow(0 0 4px color-mix(in oklab, ${color} 60%, transparent))`,
            }}
          />
        )}
      </div>

      <div className="relative grid flex-1 content-center justify-items-center gap-2.5 px-2 pb-2.5 pt-2">
        {/* Re-keyed on the value, so every change plays the pop. */}
        <span
          key={value}
          className="stat-pop num font-mono text-5xl font-bold leading-none text-text"
          style={{ textShadow: `0 0 18px color-mix(in oklab, ${color} 45%, transparent)` }}
        >
          {value}
        </span>
        <div
          className="flex gap-1"
          role="img"
          aria-label={`${value} on a scale of ${STAT_SCALE.min} to ${STAT_SCALE.max}`}
        >
          {Array.from({ length: PIPS }, (_, i) => {
            const lit = i < value - STAT_SCALE.min + 1;
            return (
              <i
                key={i}
                className="h-1.5 w-[15px] transition-[background-color,box-shadow] duration-200"
                style={{
                  background: lit
                    ? color
                    : "color-mix(in oklab, var(--color-hairline) 70%, transparent)",
                  boxShadow: lit ? `0 0 8px -1px ${color}` : undefined,
                }}
              />
            );
          })}
        </div>
      </div>

      {mark && (
        <span
          className="absolute bottom-[41px] left-0 py-0.5 pl-2.5 pr-2 font-mono text-[9px] font-bold tracking-[0.2em] text-ground"
          style={{ background: accent }}
        >
          {mark === "edge" ? "EDGE" : "WEAK"}
        </span>
      )}

      <div className="relative grid grid-cols-2 divide-x divide-hairline border-t border-hairline">
        <StepButton label={`Lower ${upper}`} disabled={!canLower} onStep={() => onStep(-1)}>
          −
        </StepButton>
        <StepButton label={`Raise ${upper}`} disabled={!canRaise} onStep={() => onStep(1)}>
          +
        </StepButton>
      </div>

      <StatInfoModal stat={stat} value={value} roleId={roleId} open={open} onOpenChange={setOpen} />
    </div>
  );
}
