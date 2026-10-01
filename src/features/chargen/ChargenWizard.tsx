import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { fixerMethodReaction, fixerSays, fixerShortName, fixerVoice } from "./interview";
import { FixerLine } from "./FixerLine";
import { StepPanel } from "./StepPanels";
import { StepRail } from "./StepRail";
import { methodChangeLosesWork, stepsFor } from "./steps";
import { useDraftSync } from "./useDraftSync";
import { useDevelopingPortrait } from "./useDevelopingPortrait";
import { NCAmp } from "@/features/music/ncamp/NCAmp";
import { finishTrackThenStop, startMusic, stopMusic } from "@/features/music/musicDirector";
import { stepStatuses, validateStep } from "./validation";

type PendingChange =
  | { kind: "method"; method: CreationMethod; advance: boolean }
  | { kind: "role"; roleId: string; advance: boolean }
  | null;

/**
 * Where each fixer's venue is cropped behind their question. The banner is a
 * wide strip of a 16:9 picture, and the middle of it is rarely the part worth
 * keeping: the words sit on the left, so this aims at the detail on the right.
 */
const VENUE_FOCUS: Record<string, string> = {
  "venue-ilsa-braun": "60% 30%",
  "venue-tally": "60% 32%",
  "venue-dinh-bao-tran": "55% 42%",
  "venue-rosalind-achebe": "60% 40%",
  "venue-yuri-pastrana": "55% 50%",
  "venue-kit-mwangi": "60% 28%",
};

const SAVE_FAILED = "Save failed";

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
  // The fixer's reaction to the Role, carried onto the next step's question
  // when choosing the Role is also what moved the player on.
  const [carried, setCarried] = useState<{ step: string; line: string } | null>(null);
  const navigate = useNavigate();

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
  // The meet opens on its own scene, which is the page's heading: no second
  // title over it, and no red "missing" line before the player has done anything.
  const atMeet = def.id === "fixer";
  // Steps whose own screen already says what is missing; a red list under them is a scolding.
  const quiet = atMeet || def.id === "role" || def.id === "method";
  // The Lifepath's chapters each have a header of their own, in this one's place.
  const ownsHeader = def.id === "lifepath";
  const nextLabel = atMeet && fixer ? `Sit down with ${fixerShortName(fixer)}` : "Next";

  // Back always goes somewhere: from the first step, out to the roster. The
  // draft autosaves, so leaving loses nothing.
  function goBack() {
    if (index === 0) void navigate({ to: "/roster" });
    else state.back();
  }

  // Every step starts at the top, no matter how far down the previous one was scrolled.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [state.step]);

  // Arriving with the fixer's reaction: the Lifepath, whose chapters normally
  // speak for the fixer, shows it too on that one arrival.
  const carriedHere = carried !== null && carried.step === def.id;

  // A carried reaction belongs to the step it was carried onto, and only once.
  useEffect(() => {
    if (carried && state.step !== carried.step) setCarried(null);
  }, [state.step, carried]);

  // The creator is scored by a shuffled playlist, whatever the step. Leaving
  // it for the game lets the track that is playing carry the character into
  // night one and end there; leaving it any other way fades it out.
  useEffect(() => {
    startMusic();
    return () => {
      if (window.location.pathname.startsWith("/play/")) finishTrackThenStop();
      else stopMusic();
    };
  }, []);

  const hasDependentData =
    state.skills.length > 0 ||
    state.loadout.lines.length > 0 ||
    Object.keys(state.loadout.packageChoices).length > 0 ||
    Object.keys(state.lifepath.roleSpecific).length > 0;

  /** Take these terms, and with `advance`, go straight on with the fixer's reaction. */
  function takeMethod(method: CreationMethod, advance: boolean) {
    if (state.method !== method) state.selectMethod(method);
    if (!advance) return;
    const ids = stepsFor(method).map((s) => s.id);
    const nextId = ids[ids.indexOf("method") + 1];
    const line = fixerMethodReaction(fixer, method);
    if (line && nextId) setCarried({ step: nextId, line });
    useChargenStore.getState().setStep(nextId ?? "method");
  }

  function requestMethod(method: CreationMethod, advance = false) {
    // Switching is free until it would throw away STATs, Skills or gear.
    if (state.method && state.method !== method && methodChangeLosesWork(state)) {
      setPending({ kind: "method", method, advance });
      return;
    }
    takeMethod(method, advance);
  }

  /** Take the Role, and with `advance`, go straight on to the next step with the fixer's reaction. */
  function takeRole(roleId: string, advance: boolean) {
    if (state.roleId !== roleId) state.selectRole(roleId);
    if (!advance) return;
    const line = fixerSays(fixer, "role", roleId);
    const nextId = stepIds[stepIds.indexOf("role") + 1];
    if (line && nextId) setCarried({ step: nextId, line });
    useChargenStore.getState().setStep(nextId ?? "role");
  }

  function requestRole(roleId: string, advance = false) {
    if (state.roleId && state.roleId !== roleId && hasDependentData) {
      setPending({ kind: "role", roleId, advance });
      return;
    }
    takeRole(roleId, advance);
  }

  function applyPending() {
    if (!pending) return;
    if (pending.kind === "method") takeMethod(pending.method, pending.advance);
    else takeRole(pending.roleId, pending.advance);
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
        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border border-border bg-background/90 px-3 py-3 sm:gap-3 sm:px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="min-w-0 space-y-0.5">
            <span className="block whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-accent sm:tracking-[0.25em]">
              {def.index + 1} / {steps.length}
            </span>
            <span className="block text-[10px] font-semibold leading-tight tracking-tight text-text-muted sm:whitespace-nowrap sm:text-[11px]">
              {def.title}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <NCAmp />
            <Button variant="outline" size="sm" onClick={goBack}>
              Back
            </Button>
            <Button
              size="sm"
              onClick={state.next}
              disabled={violations.length > 0 || index === stepIds.length - 1}
            >
              {nextLabel}
            </Button>
          </div>
        </div>

        {!atMeet && !ownsHeader && (
          <header
            className={cn(
              "relative overflow-hidden border-b border-border pb-5",
              venueShown && "flex min-h-[11rem] items-center border border-hairline px-5 pt-5",
            )}
          >
            <Backdrop name={venue} text="left" focus={venue ? VENUE_FOCUS[venue] : undefined} />
            {/* The step's name is in the bar above and the list beside; the
                header is the fixer's question, and nothing else unless it is
                help, or a save that failed. */}
            {STEP_HELP[def.id] && (
              <button
                type="button"
                aria-label={`About ${def.title}`}
                onClick={() => setHelpOpen(true)}
                className="absolute right-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background/60 font-mono text-[10px] text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              >
                ?
              </button>
            )}
            <div className="relative w-full space-y-3">
              {/* The Lifepath's chapters each open with the fixer's own line, so
                  the step does not ask a question of its own on top of them. */}
              {(def.id !== "lifepath" || carriedHere) && (
                <FixerLine
                  fixer={fixer}
                  step={def.id}
                  roleId={state.roleId}
                  lead={carriedHere ? carried.line : null}
                />
              )}
              {((def.id === "lifepath" && !carriedHere) || !fixer) && (
                <h1 className="text-3xl font-bold tracking-tight">{def.title}</h1>
              )}
              {saveStatus === "error" && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-destructive">
                  {SAVE_FAILED}
                  {saveError ? ` · ${saveError}` : ""}
                </p>
              )}
            </div>
          </header>
        )}

        {ownsHeader && saveStatus === "error" && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-destructive">
            {SAVE_FAILED}
            {saveError ? ` · ${saveError}` : ""}
          </p>
        )}

        <StepPanel
          step={state.step}
          lead={carriedHere ? carried.line : null}
          state={state}
          onRequestMethod={requestMethod}
          onRequestRole={requestRole}
        />

        {/* The File lists what is missing in its own checklist, with a way to each step. */}
        {violations.length > 0 && def.id !== "review" && !quiet && (
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
          <Button variant="outline" onClick={goBack}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            {violations.length > 0 && !quiet && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Answer what is missing to go on
              </span>
            )}
            <Button
              onClick={state.next}
              disabled={violations.length > 0 || index === stepIds.length - 1}
            >
              {nextLabel}
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
