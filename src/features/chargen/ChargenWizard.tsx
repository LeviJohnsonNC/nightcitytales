import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { CreationMethod } from "@/engine";
import { useChargenStore } from "./store";
import { StepPanel } from "./StepPanels";
import { StepRail } from "./StepRail";
import { stepsFor } from "./steps";
import { useDraftSync } from "./useDraftSync";
import { stepStatuses, validateStep } from "./validation";

type PendingChange =
  { kind: "method"; method: CreationMethod } | { kind: "role"; roleId: string } | null;

const SAVE_LABEL: Record<string, string> = {
  loading: "Loading draft…",
  idle: "Draft ready",
  saving: "Saving…",
  saved: "Draft saved",
  error: "Save failed",
};

export function ChargenWizard({ userId }: { userId: string }) {
  const state = useChargenStore();
  const { status: saveStatus, error: saveError } = useDraftSync(userId);
  const [pending, setPending] = useState<PendingChange>(null);

  const steps = stepsFor(state.method);
  const stepIds = steps.map((s) => s.id);
  const def = steps.find((s) => s.id === state.step) ?? steps[0]!;
  const statuses = stepStatuses(state);
  const { violations } = validateStep(state.step, state);
  const index = stepIds.indexOf(def.id);

  const hasDependentData =
    state.skills.length > 0 ||
    state.loadout.lines.length > 0 ||
    Object.keys(state.loadout.packageChoices).length > 0 ||
    Object.keys(state.lifepath.roleSpecific).length > 0;

  function requestMethod(method: CreationMethod) {
    // Method is switchable freely until a Role is locked; after that it restarts.
    if (state.method && state.method !== method && state.roleId) {
      setPending({ kind: "method", method });
      return;
    }
    state.selectMethod(method);
  }

  function requestRole(roleId: string) {
    if (state.roleId && state.roleId !== roleId && hasDependentData) {
      setPending({ kind: "role", roleId });
      return;
    }
    state.selectRole(roleId);
  }

  function applyPending() {
    if (!pending) return;
    if (pending.kind === "method") state.selectMethod(pending.method);
    else state.selectRole(pending.roleId);
    setPending(null);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <StepRail current={state.step} statuses={statuses} onSelect={state.setStep} />
      </aside>

      <section className="min-w-0 space-y-6">
        {/* Sticky quick-nav so Back/Next are always reachable without scrolling the panel. */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border border-border bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
              Step {String(def.index).padStart(2, "0")} /{" "}
              {String(CHARGEN_STEPS.length - 1).padStart(2, "0")}
            </span>
            <span className="hidden truncate text-sm font-semibold tracking-tight sm:inline">
              {def.title}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={state.back} disabled={index === 0}>
              Back
            </Button>
            <Button
              size="sm"
              onClick={state.next}
              disabled={violations.length > 0 || index === STEP_IDS.length - 1}
            >
              Next
            </Button>
          </div>
        </div>

        <header className="border-b border-border pb-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
            Step {String(def.index).padStart(2, "0")} /{" "}
            {String(CHARGEN_STEPS.length - 1).padStart(2, "0")}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{def.title}</h1>

          <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {SAVE_LABEL[saveStatus]}
            {saveError ? ` — ${saveError}` : ""}
          </p>
        </header>

        <StepPanel
          step={state.step}
          state={state}
          onRequestMethod={requestMethod}
          onRequestRole={requestRole}
        />

        {violations.length > 0 && (
          <ul className="space-y-1.5 text-sm text-foreground">
            {violations.map((violation) => (
              <li key={violation} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-[0.45rem] h-2 w-2 shrink-0 rounded-full bg-destructive"
                />
                <span>{violation}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={state.back} disabled={index === 0}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            {violations.length > 0 && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Fix the listed rules to continue
              </span>
            )}
            <Button
              onClick={state.next}
              disabled={violations.length > 0 || index === STEP_IDS.length - 1}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "method" ? "Restart this character?" : "Change Role?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "method"
                ? "Changing the creation method restarts the character. Every choice you have made so far is discarded."
                : "Changing your Role wipes your Skills, Gear, Cyberware, and the Role-specific part of your Lifepath. Your STATs and general Lifepath are kept."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep what I have</AlertDialogCancel>
            <AlertDialogAction onClick={applyPending}>
              {pending?.kind === "method" ? "Restart" : "Change Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
