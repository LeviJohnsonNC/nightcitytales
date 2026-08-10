import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BuildLog, PrintButton } from "./BuildLog";
import { CharacterSheet } from "./CharacterSheet";
import { downloadCharacterJson } from "./characterExport";
import { finalChecklist, gatePassed } from "./finalGate";
import { saveCharacterFromState } from "./saveCharacter";
import { assembledFromState, buildFromState } from "./sheetModel";
import { useChargenStore, type ChargenState } from "./store";

export function ReviewPanel({ state }: { state: ChargenState }) {
  const navigate = useNavigate();
  const setStep = useChargenStore((s) => s.setStep);
  const reset = useChargenStore((s) => s.reset);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = useMemo(() => finalChecklist(state), [state]);
  const passed = gatePassed(checks);
  const build = useMemo(() => buildFromState(state), [state]);
  const sheet = useMemo(() => assembledFromState(state), [state]);

  async function save() {
    // Re-run the gate at the moment of saving: an invalid character never saves.
    if (!gatePassed(finalChecklist(useChargenStore.getState()))) return;
    setSaving(true);
    setError(null);
    try {
      const id = await saveCharacterFromState(state, build, sheet);
      reset();
      await navigate({ to: "/character/$id", params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="no-print border border-hairline bg-surface p-4">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.18em] text-text">
          Final validation
        </h2>
        <ul className="mt-3 space-y-2">
          {checks.map((check) => (
            <li key={check.step} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-mono text-[11px] uppercase tracking-[0.16em] ${
                    check.passed ? "text-success" : "text-danger"
                  }`}
                >
                  {check.passed ? "PASS" : "FAIL"}
                </span>
                <span className="text-text">{check.title}</span>
                {!check.passed && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => setStep(check.step)}
                  >
                    Fix in {check.title}
                  </Button>
                )}
              </div>
              {!check.passed && (
                <ul className="ml-14 mt-1 list-disc space-y-0.5 text-text-muted">
                  {check.violations.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
          <Button onClick={save} disabled={!passed || saving}>
            {saving ? "Saving…" : "Save to roster"}
          </Button>
          <PrintButton />
          <Button variant="outline" onClick={() => downloadCharacterJson(state, build, sheet)}>
            Export JSON
          </Button>
          {!passed && (
            <span className="font-mono text-[11px] uppercase tracking-wider text-text-dim">
              Every check must pass — there is no save-anyway
            </span>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </section>

      <CharacterSheet state={state} build={build} sheet={sheet} />

      <div className="no-print">
        <BuildLog />
      </div>
    </div>
  );
}
