import { CREATION_RULES, STAT_ORDER, WOUND_STATES, deriveStats } from "@/engine";
import type { StatBlock } from "@/engine";
import type { ChargenState } from "./store";

const FORMULAS = CREATION_RULES.derivedStats;

/**
 * Substitutes the character's STAT values into the formula strings printed in
 * src/data/rules/creation-rules.json. No arithmetic happens here — every number
 * shown comes from the engine's deriveStats().
 */
function worked(formula: string, values: Record<string, number>) {
  let out = formula.replace(/\*/g, "×");
  for (const [token, value] of Object.entries(values)) {
    out = out.replaceAll(token, `${token} ${value}`);
  }
  return out;
}

export function DerivedPanel({ state }: { state: ChargenState }) {
  const complete = STAT_ORDER.every((s) => typeof state.stats[s] === "number");

  if (!complete) {
    return (
      <div className="border border-dashed border-hairline bg-surface/50 p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          Derived STATs — waiting on STATs
        </p>
        <p className="mt-2 text-sm text-text-muted">
          These four values are computed by the rules engine the moment every STAT has a
          number. Nothing here is editable — the sheet writes what the engine says.
        </p>
      </div>
    );
  }

  const stats = state.stats as StatBlock;
  const derived = deriveStats(stats);

  const rows = [
    {
      label: "Hit Points",
      value: derived.hpMax,
      formula: worked(FORMULAS.hitPoints, { BODY: stats.body, WILL: stats.will }),
    },
    {
      label: "Seriously Wounded",
      value: derived.seriouslyWoundedThreshold,
      formula: worked(FORMULAS.seriouslyWoundedThreshold, { HP: derived.hpMax }),
    },
    {
      label: "Death Save",
      value: derived.deathSave,
      formula: worked(FORMULAS.deathSave, { BODY: stats.body }),
    },
    {
      label: "Humanity",
      value: derived.humanityMax,
      formula: worked(FORMULAS.humanity, { EMP: stats.emp }),
    },
  ];

  return (
    <div className="space-y-6">
      <dl className="divide-y divide-hairline border border-hairline bg-surface">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-4">
            <dt className="w-44 shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
              {row.label}
            </dt>
            <dd className="num font-mono text-3xl font-semibold tabular-nums text-text">
              {row.value}
            </dd>
            <span className="font-mono text-sm text-text-muted">
              <span className="text-ember">←</span> {row.formula}
            </span>
          </div>
        ))}
      </dl>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ember">
          Wound State ladder — what those numbers buy you
        </h2>
        <ul className="divide-y divide-hairline border border-hairline bg-surface">
          {WOUND_STATES.map((wound) => (
            <li key={wound.state} className="p-4">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-lg font-semibold text-text">{wound.state}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-dim">
                  {wound.threshold}
                </span>
                {wound.stabilizationDV !== null && (
                  <span className="ml-auto font-mono text-[11px] text-text-dim">
                    stabilization DV{wound.stabilizationDV}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-text-muted">{wound.effect}</p>
              {wound.note && (
                <p className="mt-1 font-mono text-[11px] text-text-dim">{wound.note}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="border-l-2 border-ember/70 bg-ember/5 p-3 text-sm text-text-muted">
        Humanity {derived.humanityMax} is your starting ceiling. Installing cyberware in a
        later step subtracts from it, and your EMP drops by 1 each time Humanity crosses a
        tens boundary downward — {CREATION_RULES.humanity.empFromHumanity}
      </p>
    </div>
  );
}
