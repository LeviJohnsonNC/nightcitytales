import { useEffect, useState } from "react";
import { AGE_MAX, AGE_MIN, SEXES, pronounsFor, sexLabel, validAge, type Sex } from "@/engine";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useChargenStore, type ChargenState } from "./store";

/**
 * Mars and Venus drawn as strokes rather than typed as glyphs, so they can carry
 * a neon glow and stay crisp at any size. Cyan for one, magenta for the other:
 * the two neon hues the rest of the file already lives in.
 */
const GLYPH: Record<Sex, { paths: string[]; tone: string; on: string; off: string }> = {
  male: {
    paths: [
      "M10.5 13.5m-5.5 0a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0",
      "M14.4 9.6L20 4",
      "M14.5 4H20v5.5",
    ],
    tone: "text-neon-cyan",
    on: "border-neon-cyan bg-neon-cyan/10 shadow-[0_0_16px_-3px_var(--color-neon-cyan),inset_0_0_12px_-6px_var(--color-neon-cyan)]",
    off: "hover:border-neon-cyan/60 hover:shadow-[0_0_12px_-5px_var(--color-neon-cyan)]",
  },
  female: {
    paths: ["M12 9.5m-5.5 0a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0", "M12 15v7", "M8.5 18.5h7"],
    tone: "text-neon-pink",
    on: "border-neon-pink bg-neon-pink/10 shadow-[0_0_16px_-3px_var(--color-neon-pink),inset_0_0_12px_-6px_var(--color-neon-pink)]",
    off: "hover:border-neon-pink/60 hover:shadow-[0_0_12px_-5px_var(--color-neon-pink)]",
  },
};

function SexGlyph({ sex, lit }: { sex: Sex; lit: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn(
        "size-7 fill-none stroke-current transition-[filter,opacity] duration-200",
        lit
          ? "opacity-100 [filter:drop-shadow(0_0_2px_currentColor)_drop-shadow(0_0_7px_currentColor)]"
          : "opacity-55",
      )}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPH[sex].paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * Who a stranger sees: sex and age. Asked with who you are, because the first
 * picture on the file needs both and because the people you meet read both
 * before they read anything else. Pronouns follow from the sex chosen.
 */
export function WhoPicker({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  // What is typed in the box, which is not always an age yet ("7", on the way to 71).
  const [typed, setTyped] = useState(state.age === null ? "" : String(state.age));
  useEffect(() => {
    setTyped(state.age === null ? "" : String(state.age));
    // Only when the age changes from outside, such as a draft loading.
  }, [state.age]);
  const invalid = typed.trim() !== "" && validAge(typed) === null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border border-hairline bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="mr-1 font-display text-xs font-bold uppercase tracking-[0.12em] text-text">
          Sex
        </span>
        {SEXES.map((sex) => (
          <button
            key={sex}
            type="button"
            aria-pressed={state.sex === sex}
            aria-label={sexLabel(sex)}
            title={sexLabel(sex)}
            onClick={() => patch({ sex, pronouns: pronounsFor(sex) })}
            className={cn(
              "grid size-11 place-items-center border transition-[border-color,background-color,box-shadow] duration-200",
              GLYPH[sex].tone,
              state.sex === sex ? GLYPH[sex].on : cn("border-hairline", GLYPH[sex].off),
            )}
          >
            <SexGlyph sex={sex} lit={state.sex === sex} />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label
          htmlFor="chargen-age"
          className="mr-1 font-display text-xs font-bold uppercase tracking-[0.12em] text-text"
        >
          Age
        </label>
        <Input
          id="chargen-age"
          inputMode="numeric"
          className={cn("h-10 w-20 text-center font-mono text-lg", invalid && "border-destructive")}
          value={typed}
          maxLength={2}
          placeholder="--"
          aria-invalid={invalid}
          title={`${AGE_MIN}–${AGE_MAX}`}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            setTyped(digits);
            patch({ age: validAge(digits) });
          }}
        />
      </div>
    </div>
  );
}
