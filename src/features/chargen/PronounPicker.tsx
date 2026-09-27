import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useChargenStore, type ChargenState } from "./store";

const PRESETS = ["she/her", "he/him", "they/them"];

/**
 * How people talk about you. Asked with who you are, rather than at the very
 * end with the name, because the first picture on the file needs it.
 */
export function PronounPicker({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  return (
    <div className="flex flex-wrap items-center gap-2 border border-hairline bg-surface p-3">
      <span className="mr-1 font-display text-xs font-bold uppercase tracking-[0.12em] text-text">
        Pronouns
      </span>
      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={state.pronouns === preset}
          onClick={() => patch({ pronouns: preset })}
          className={cn(
            "border px-3 py-1 font-mono text-[11px] tracking-[0.1em] transition-colors duration-200",
            state.pronouns === preset
              ? "border-ember bg-ember/15 text-text"
              : "border-hairline text-text-muted hover:border-ember/60",
          )}
        >
          {preset}
        </button>
      ))}
      <Input
        className="h-8 w-40"
        value={PRESETS.includes(state.pronouns) ? "" : state.pronouns}
        onChange={(e) => patch({ pronouns: e.target.value })}
        placeholder="Or your own"
        aria-label="Pronouns"
      />
    </div>
  );
}
