/**
 * LIFE — the screen between jobs. One situation at a time, three concrete
 * things to do about it, a free-text box, and a clock that costs something to
 * spend. A job can only appear here as an offer with an explicit Accept.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  clampLuckSpend,
  formatDuration,
  formatLifeClock,
  getSkill,
  luckModifier,
  luckPoolMax,
  luckRemaining,
  opposedCheckForCharacter,
  resolveSkillId,
  skillCheckForCharacter,
  woundActionPenalty,
  TIME_COSTS,
  type WoundStateCode,
} from "@/engine";
import { CheckCard } from "@/features/play/CheckCard";
import { SheetDrawer } from "@/features/play/SheetDrawer";
import { actorFor, gmSkillList, statsRecord } from "@/features/play/playModel";
import { oppositionFor, type CheckRoll, type PendingCheck } from "@/features/play/checkPrompt";
import type { CampaignEvent } from "@/lib/backend";
import { useLife } from "./useLife";
import type { LifeActionCard } from "./lifeResponse";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

function LifeEvent({ event }: { event: CampaignEvent }) {
  const text = event.summary ?? "";
  if (!text) return null;
  switch (event.type) {
    case "player_input":
      return (
        <p className="border-l-2 border-accent/60 pl-3 text-sm italic text-accent">&gt; {text}</p>
      );
    case "life_narration":
      return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text}</p>;
    case "skill_check":
      return (
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-accent">◆</span> {text}
        </p>
      );
    case "hook_offered":
    case "hook_declined":
    case "mission_started":
      return (
        <p className="my-1 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          — {text} —
        </p>
      );
    case "check_prompt":
      return null;
    default:
      return <p className="font-mono text-xs text-muted-foreground">{text}</p>;
  }
}

const LIFE_EVENT_TYPES = new Set([
  "player_input",
  "life_narration",
  "life_action",
  "life_note",
  "skill_check",
  "hook_offered",
  "hook_declined",
  "mission_started",
  "mission_completed",
]);

function LifeLog({ events, busy }: { events: CampaignEvent[]; busy: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);
  const shown = events.filter((e) => LIFE_EVENT_TYPES.has(e.type)).slice(-40);
  return (
    <div className="flex-1 space-y-3 overflow-y-auto border border-border bg-card/40 p-4">
      {shown.length === 0 && !busy ? (
        <p className="text-sm text-muted-foreground">The city hums on without you…</p>
      ) : (
        shown.map((e) => <LifeEvent key={e.id} event={e} />)
      )}
      {busy && <p className="text-sm italic text-muted-foreground">Night City turns…</p>}
      <div ref={endRef} />
    </div>
  );
}

/** One of the three offered actions: what it costs in time, money and dice. */
function ActionCard({
  action,
  character,
  onPick,
  busy,
}: {
  action: LifeActionCard;
  character: ReturnType<typeof useLife>["bundle"] extends infer B
    ? B extends { character: infer C }
      ? C
      : never
    : never;
  onPick: () => void;
  busy: boolean;
}) {
  const skillId = action.skillId ? resolveSkillId(action.skillId) : null;
  const hint = skillId
    ? {
        name: getSkill(skillId).name,
        base: gmSkillList(character as never).find((s) => s.id === skillId)?.base ?? 0,
      }
    : null;

  const button = (
    <Button
      variant="outline"
      disabled={busy}
      onClick={onPick}
      className={`h-auto w-full flex-col items-start gap-1 whitespace-normal p-3 text-left ${
        hint ? "border-neon-pink shadow-[0_0_8px_rgba(255,61,154,0.25)]" : ""
      }`}
    >
      <span className="text-sm font-semibold">{action.label}</span>
      {action.description && (
        <span className="text-xs font-normal text-muted-foreground">{action.description}</span>
      )}
      <span className="num font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {formatDuration(action.timeMinutes)}
        {action.knownCost ? ` · ${action.knownCost}eb` : ""}
      </span>
    </Button>
  );

  if (!hint) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs border border-neon-pink bg-card text-foreground"
      >
        <Label>Skill</Label>
        <p className="text-sm font-semibold">
          {hint.name}: {hint.base}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function HookCard({ life }: { life: ReturnType<typeof useLife> }) {
  const hook = life.hook;
  const [reason, setReason] = useState("");
  if (!hook) return null;
  return (
    <section className="space-y-3 border border-neon-pink bg-neon-pink/5 p-4">
      <Label>Work on the table</Label>
      <div>
        <h3 className="text-base font-bold">{hook.title}</h3>
        <p className="text-sm text-muted-foreground">
          {hook.patron}
          {hook.payout ? ` · ${hook.payout}eb` : ""}
        </p>
      </div>
      <p className="text-sm leading-relaxed">{hook.summary}</p>
      <p className="text-xs text-muted-foreground">
        Nothing starts until you say yes. Ask questions, push for more, sleep on it, or walk.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={life.busy} onClick={() => life.acceptHook()}>
          Take the job
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={life.busy}
          onClick={() => life.declineHook(reason || "Not this one.")}
        >
          Turn it down
        </Button>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="…or say why (optional)"
          className="min-w-[12rem] flex-1 border border-border bg-background px-2 py-1 text-sm"
          disabled={life.busy}
        />
      </div>
    </section>
  );
}

function InputBar({
  onSend,
  busy,
}: {
  onSend: (text: string) => Promise<boolean> | void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const payload = `${trimmed}\n(ENGINE: judge this case by case. If it could plausibly fail and failure would matter, propose a skill_check with a skillId from the SKILLS list and a DV from the published table, and stop. If it is routine, just narrate it. Do not start a job.)`;
    const result = await onSend(payload);
    if (result !== false) setText("");
  };
  return (
    <div className="flex gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        placeholder="What do you do with your evening? (Enter to act, Shift+Enter for a new line)"
        rows={2}
        className="flex-1 resize-none"
        disabled={busy}
      />
      <Button onClick={() => void send()} disabled={busy || !text.trim()}>
        {busy ? "…" : "Act"}
      </Button>
    </div>
  );
}

export function LifeScreen({ campaignId }: { campaignId: string }) {
  const life = useLife(campaignId);
  const bundle = life.bundle;

  // Open the first moment automatically, once, so Life is never a blank page.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!bundle || life.busy || life.actionError) return;
    if (life.narration || life.pendingCheck) return;
    const key = `${bundle.campaign.id}:${bundle.clock.day}`;
    if (opened.current === key) return;
    opened.current = key;
    life.openMoment();
  }, [bundle, life]);

  if (life.isPending) {
    return <p className="p-8 text-sm text-muted-foreground">Loading your life…</p>;
  }
  if (life.error) return <p className="p-8 text-sm text-destructive">{life.error.message}</p>;
  if (!bundle) return null;

  const luckMax = luckPoolMax(statsRecord(bundle.character));
  const luckLeft = luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character));

  /** The engine rolls; the card only animates toward what it rolled. */
  const rollCheck = (pending: PendingCheck, luckSpend: number): CheckRoll => {
    const actor = actorFor(bundle.character);
    const luckSpent = clampLuckSpend(luckSpend, luckLeft);
    const spend = luckModifier(luckSpent);
    const wounds = woundActionPenalty(bundle.vitals.wound_state as WoundStateCode);
    const situational = [
      ...(spend ? [spend] : []),
      ...(wounds !== 0 ? [{ label: "Wounds", value: wounds }] : []),
    ];
    const modifiers = situational.length > 0 ? { modifiers: situational } : {};
    const opposition = oppositionFor(pending);
    if (opposition) {
      return {
        kind: "opposed",
        luckSpent,
        result: opposedCheckForCharacter(actor, pending.skillId, opposition, undefined, {
          actorName: bundle.character.character.name,
          ...modifiers,
        }),
      };
    }
    if (pending.dv === null) throw new Error("That check has neither a DV nor an opponent.");
    return {
      kind: "dv",
      luckSpent,
      result: skillCheckForCharacter(actor, pending.skillId, pending.dv, undefined, modifiers),
    };
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-[70vh] flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{bundle.campaign.name}</h1>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                Life · {formatLifeClock(bundle.clock)} · day {bundle.clock.day}
              </p>
            </div>
            <SheetDrawer character={bundle.character} />
          </div>

          {life.narration && (
            <section className="border-l-2 border-accent bg-accent/5 p-3">
              <Label>{life.narration.title}</Label>
              <p className="mt-1 text-sm leading-relaxed">{life.narration.text}</p>
            </section>
          )}

          <LifeLog events={bundle.events} busy={life.busy} />

          {life.actionError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {life.actionError.message}
            </p>
          )}

          {life.hook && <HookCard life={life} />}

          {life.pendingCheck && (
            <CheckCard
              key={life.pendingCheck.eventId}
              pending={life.pendingCheck}
              roll={(luckSpend) => rollCheck(life.pendingCheck!, luckSpend)}
              onSettled={(rolled) => life.commitCheck(life.pendingCheck!, rolled)}
              busy={life.checkBusy}
              luckRemaining={luckLeft}
            />
          )}

          {!life.pendingCheck && life.actions.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {life.actions.map((action) => (
                <ActionCard
                  key={action.label}
                  action={action}
                  character={bundle.character as never}
                  busy={life.busy}
                  onPick={() =>
                    void life.act(
                      `${action.label}. ${action.description}`.trim(),
                      action.timeMinutes || TIME_COSTS.quick,
                    )
                  }
                />
              ))}
            </div>
          )}

          <InputBar onSend={(text) => life.act(text)} busy={life.busy || !!life.pendingCheck} />
        </div>

        <aside className="space-y-4">
          <section className="space-y-3 border border-border bg-card p-4">
            <div>
              <h2 className="text-lg font-bold leading-tight">{bundle.character.character.name}</h2>
              <p className="text-sm text-muted-foreground">
                {bundle.character.character.handle
                  ? `"${bundle.character.character.handle}" · `
                  : ""}
                {bundle.character.character.role}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <Label>HP</Label>
                <p className="num text-lg font-bold">
                  {bundle.vitals.hp_current}/{bundle.vitals.hp_max}
                </p>
              </div>
              <div>
                <Label>Wound</Label>
                <p className="text-sm font-semibold capitalize">{bundle.vitals.wound_state}</p>
              </div>
              <div>
                <Label>Humanity</Label>
                <p className="num text-lg font-bold">
                  {bundle.vitals.humanity_current}/{bundle.vitals.humanity_max}
                </p>
              </div>
            </div>
            <div>
              <Label>Eurobucks</Label>
              <p className="num text-base font-bold">{bundle.vitals.eurobucks}eb</p>
            </div>
            {luckMax > 0 && (
              <div>
                <Label>Luck</Label>
                <p className="num text-base font-bold">
                  {luckLeft}/{luckMax}
                </p>
              </div>
            )}
          </section>

          {life.situations.length > 0 && (
            <section className="space-y-2 border border-border bg-card p-4">
              <Label>On your plate</Label>
              <ul className="space-y-2">
                {life.situations.slice(0, 8).map((s) => (
                  <li key={s.key} className="text-sm">
                    <span
                      className={
                        s.key === life.situation?.key ? "font-semibold text-accent" : "font-medium"
                      }
                    >
                      {s.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">{s.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {life.clocks.length > 0 && (
            <section className="space-y-2 border border-border bg-card p-4">
              <Label>Pressure</Label>
              {life.clocks.map((c) => (
                <div key={c.key}>
                  <p className="flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="num font-mono text-xs text-muted-foreground">
                      {c.filled}/{c.segments}
                    </span>
                  </p>
                  <div className="mt-1 flex gap-1" aria-hidden>
                    {Array.from({ length: c.segments }, (_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 ${i < c.filled ? "bg-destructive" : "bg-border"}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/roster">Back to the roster</Link>
          </Button>
        </aside>
      </div>
    </TooltipProvider>
  );
}
