import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CreationMethod } from "@/engine";
import { useChargenStore } from "./store";
import { cn } from "@/lib/utils";
import { uploadedAsset } from "./art";
import { Backdrop } from "./Backdrop";
import { CharacterFile } from "./CharacterFile";
import { fixerVoice } from "./interview";
import { FixerLine } from "./FixerLine";
import { StepPanel } from "./StepPanels";
import { StepRail } from "./StepRail";
import { methodChangeLosesWork, stepsFor } from "./steps";
import { useDraftSync } from "./useDraftSync";
import { useDevelopingPortrait } from "./useDevelopingPortrait";
import { MusicToggle } from "./music/MusicToggle";
import { currentCue, setBaseCue } from "./music/musicDirector";
import { cueForStep } from "./music/soundtrack";
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

const STEP_HELP: Record<string, { title: string; body: string }> = {
  gear: {
    title: "Night Market",
    body: "Two budgets, and they do not mix. Gear money buys anything and what you do not spend is yours. Fashion money buys only Fashion and Fashionware, and anything left of it is gone for good.",
  },
};

export function ChargenWizard({ userId }: { userId: string }) {
  const state = useChargenStore();
  const { status: saveStatus, error: saveError } = useDraftSync(userId);
  const [pending, setPending] = useState<PendingChange>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const steps = stepsFor(state.method);
  const stepIds = steps.map((s) => s.id);
  const def = steps.find((s) => s.id === state.step) ?? steps[0]!;
  const statuses = stepStatuses(state);
  const { violations } = validateStep(state.step, state);
  const index = stepIds.indexOf(def.id);
  const fixer = state.castPlan?.picks.fixer ?? null;
  // The fixer's own place, behind their question, once there is a fixer and an image of it.
  const venue = def.id !== "fixer" ? (fixerVoice(fixer)?.venue ?? null) : null;
  const venueShown = Boolean(venue && uploadedAsset(venue));
  const developing = useDevelopingPortrait(state, userId, saveStatus !== "loading");

  // Every step starts at the top, no matter how far down the previous one was scrolled.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [state.step]);

  // The soundtrack follows the scene. No cleanup here on purpose: two steps
  // that share a cue must not restart it.
  useEffect(() => {
    setBaseCue(cueForStep(state.step));
  }, [state.step]);

  // Leaving the creator stops the music, except the reveal, which carries the
  // character into night one.
  useEffect(
    () => () => {
      if (currentCue() !== "reveal") setBaseCue(null);
    },
    [],
  );

  const hasDependentData =
    state.skills.length > 0 ||
    state.loadout.lines.length > 0 ||
    Object.keys(state.loadout.packageChoices).length > 0 ||
    Object.keys(state.lifepath.roleSpecific).length > 0;

  function requestMethod(method: CreationMethod) {
    // Switching is free until it would throw away STATs, Skills or gear.
    if (state.method && state.method !== method && methodChangeLosesWork(state)) {
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
      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <div className="hidden lg:block">
          <CharacterFile state={state} developing={developing} />
        </div>
        <StepRail steps={steps} current={state.step} statuses={statuses} onSelect={state.setStep} />
      </aside>

      <section className="min-w-0 space-y-6">
        {/* Sticky quick-nav so Back/Next are always reachable without scrolling the panel. */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border border-border bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
              {def.index + 1} / {steps.length}
            </span>
            <span className="hidden truncate text-sm font-semibold tracking-tight sm:inline">
              {def.title}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MusicToggle />
            <Button variant="outline" size="sm" onClick={state.back} disabled={index === 0}>
              Back
            </Button>
            <Button
              size="sm"
              onClick={state.next}
              disabled={violations.length > 0 || index === stepIds.length - 1}
            >
              Next
            </Button>
          </div>
        </div>

        <header
          className={cn(
            "relative space-y-4 overflow-hidden border-b border-border pb-5",
            venueShown && "border border-hairline px-5 pt-5",
          )}
        >
          <Backdrop name={venue} text="left" />
          <div className="relative space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
                {def.title}
              </p>
              {STEP_HELP[def.id] && (
                <button
                  type="button"
                  aria-label={`About ${def.title}`}
                  onClick={() => setHelpOpen(true)}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  ?
                </button>
              )}
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {SAVE_LABEL[saveStatus]}
                {saveError ? ` · ${saveError}` : ""}
              </span>
            </div>
            {/* The Lifepath's chapters each open with the fixer's own line, so
                the step does not ask a question of its own on top of them. */}
            {def.id !== "fixer" && def.id !== "lifepath" && (
              <FixerLine fixer={fixer} step={def.id} roleId={state.roleId} />
            )}
            {(def.id === "fixer" || def.id === "lifepath" || !fixer) && (
              <h1 className="text-3xl font-bold tracking-tight">{def.title}</h1>
            )}
          </div>
        </header>

        <StepPanel
          step={state.step}
          state={state}
          userId={userId}
          onRequestMethod={requestMethod}
          onRequestRole={requestRole}
        />

        {/* The File lists what is missing in its own checklist, with a way to each step. */}
        {violations.length > 0 && def.id !== "review" && (
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
                Answer what is missing to go on
              </span>
            )}
            <Button
              onClick={state.next}
              disabled={violations.length > 0 || index === stepIds.length - 1}
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
              {pending?.kind === "method" ? "Change how you build?" : "Change Role?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "method"
                ? "Changing how you build clears your STATs, Skills and gear. Your Role, your story, your name and your fixer all stay."
                : "Changing your Role wipes your Skills, Gear, Cyberware, and the Role-specific part of your Lifepath. Your STATs and general Lifepath are kept."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep what I have</AlertDialogCancel>
            <AlertDialogAction onClick={applyPending}>
              {pending?.kind === "method" ? "Change it" : "Change Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{STEP_HELP[def.id]?.title ?? def.title}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {STEP_HELP[def.id]?.body}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
