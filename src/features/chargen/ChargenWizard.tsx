import { CHARGEN_STEPS, useChargenStore } from "./store";

/** Scaffold only — steps get built in a later pass. */
export function ChargenWizard() {
  const step = useChargenStore((s) => s.step);

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Character creation</h1>
      <p className="text-sm text-muted-foreground">
        Step {CHARGEN_STEPS.indexOf(step) + 1} of {CHARGEN_STEPS.length}: {step}
      </p>
      <p className="text-sm text-muted-foreground">Wizard UI not implemented yet.</p>
    </section>
  );
}