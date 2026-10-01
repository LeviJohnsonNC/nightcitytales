import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PrintButton } from "./BuildLog";
import { CharacterSheet } from "./CharacterSheet";
import { downloadCharacterJson } from "./characterExport";
import { finalChecklist, gatePassed } from "./finalGate";
import { saveCharacterFromState } from "./saveCharacter";
import { assembledFromState, buildFromState } from "./sheetModel";
import { useChargenStore, type ChargenState } from "./store";
import { Reveal } from "./Reveal";
import { Curtain } from "@/features/opening/descent/Curtain";
import { armDescent, disarmDescent } from "@/features/opening/descent/descentClock";
import { startAdventure } from "@/features/play/startAdventure";

export function ReviewPanel({ state }: { state: ChargenState }) {
  const navigate = useNavigate();
  const setStep = useChargenStore((s) => s.setStep);
  const reset = useChargenStore((s) => s.reset);
  const [saving, setSaving] = useState<"roster" | "city" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const checks = useMemo(() => finalChecklist(state), [state]);
  const passed = gatePassed(checks);
  const build = useMemo(() => buildFromState(state), [state]);
  const sheet = useMemo(() => assembledFromState(state), [state]);

  /**
   * Save, and either file the character or walk them straight into the city.
   * Entering starts the campaign here, so the last thing creation does is the
   * first thing play does: the cold open, with the people this screen showed.
   */
  async function save(then: "roster" | "city") {
    // Re-run the gate at the moment of saving: an invalid character never saves.
    if (!gatePassed(finalChecklist(useChargenStore.getState()))) return;
    setSaving(then);
    setError(null);
    // The descent is timed from this press, not from when the next screen
    // mounts, so the seconds the campaign takes to start are part of it.
    if (then === "city") armDescent();
    try {
      const id = await saveCharacterFromState(state, build, sheet);
      if (then === "city") {
        const adventure = await startAdventure({
          id,
          name: state.name.trim(),
          handle: state.handle.trim() || null,
        });
        // A campaign that already existed has no cold open to descend into.
        if (!adventure.created) disarmDescent();
        reset();
        await navigate({ to: "/play/$id", params: { id: adventure.id } });
        return;
      }
      reset();
      await navigate({ to: "/character/$id", params: { id } });
    } catch (e) {
      disarmDescent();
      setError(e instanceof Error ? e.message : "Saving failed.");
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      {saving === "city" && <Curtain />}
      <div className="no-print">
        <Reveal state={state} homePlaceKey={sheet.finance.homePlaceKey} />
      </div>

      <section className="no-print border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="px-8 text-base"
            onClick={() => save("city")}
            disabled={!passed || saving !== null}
          >
            {saving === "city" ? "The city is waking up…" : "Enter Night City"}
          </Button>
          <Button
            variant="outline"
            onClick={() => save("roster")}
            disabled={!passed || saving !== null}
          >
            {saving === "roster" ? "Saving…" : "Save to roster for later"}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <PrintButton />
            <Button variant="outline" onClick={() => downloadCharacterJson(state, build, sheet)}>
              Export JSON
            </Button>
          </div>
        </div>
        {!passed && (
          <ul className="mt-3 space-y-2 border-t border-hairline pt-3">
            {checks
              .filter((check) => !check.passed)
              .map((check) => (
                <li key={check.step} className="text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-danger">
                      FAIL
                    </span>
                    <span className="text-text">{check.title}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      onClick={() => setStep(check.step)}
                    >
                      Fix in {check.title}
                    </Button>
                  </div>
                  <ul className="ml-14 mt-1 list-disc space-y-0.5 text-text-muted">
                    {check.violations.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </section>

      <section className="border border-hairline bg-surface">
        <button
          type="button"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen((v) => !v)}
          className="no-print w-full px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim hover:text-text"
        >
          {sheetOpen ? "Close the full file" : "Read the whole file · every number"}
        </button>
        {/* Always printed: the print button prints this page, open or not. */}
        <div className={sheetOpen ? "border-t border-hairline p-4" : "hidden p-4 print:block"}>
          <CharacterSheet state={state} build={build} sheet={sheet} />
        </div>
      </section>
    </div>
  );
}
