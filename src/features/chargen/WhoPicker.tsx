import { useEffect, useState } from "react";
import { AGE_MAX, AGE_MIN, SEXES, pronounsFor, sexLabel, validAge, type Sex } from "@/engine";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useChargenStore, type ChargenState } from "./store";

const SYMBOL: Record<Sex, string> = { male: "♂", female: "♀" };

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
              "grid size-10 place-items-center border text-2xl leading-none transition-colors duration-200",
              state.sex === sex
                ? "border-ember bg-ember/15 text-text"
                : "border-hairline text-text-muted hover:border-ember/60",
            )}
          >
            <span aria-hidden>{SYMBOL[sex]}</span>
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
          className="h-10 w-20 text-center font-mono text-lg"
          value={typed}
          maxLength={2}
          placeholder="--"
          aria-invalid={invalid}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            setTyped(digits);
            patch({ age: validAge(digits) });
          }}
        />
        <span
          className={cn("font-mono text-[11px]", invalid ? "text-destructive" : "text-text-dim")}
        >
          {AGE_MIN}–{AGE_MAX}
        </span>
      </div>
    </div>
  );
}
