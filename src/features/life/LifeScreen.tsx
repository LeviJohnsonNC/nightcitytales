/**
 * LIFE — the screen between jobs. One situation at a time, a free-text box, and
 * a clock that costs something to spend.
 *
 * There is deliberately NO menu. The scene describes what is there; what to do
 * about it is the player's problem. Options exist only if they ask for them,
 * behind a button, and asking costs no time.
 *
 * A job can only appear here as an offer, with terms the player can push on and
 * an Accept they have to press themselves.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown } from "lucide-react";
import {
  clampLuckSpend,
  formatDuration,
  formatLifeClock,
  getFaction,
  getSkill,
  isHostile,
  knownTerms,
  luckModifier,
  luckPoolMax,
  luckRemaining,
  opposedCheckForCharacter,
  openAsks,
  resolveSkillId,
  skillCheckForCharacter,
  standingBand,
  woundActionPenalty,
  type WoundStateCode,
} from "@/engine";
import { NpcName } from "@/features/cast/NpcName";
import { NpcText } from "@/features/cast/NpcText";
import { CheckCard } from "@/features/play/CheckCard";
import { SheetDrawer } from "@/features/play/SheetDrawer";
import { BottomDock, MobileStatusBar } from "@/features/play/mobileShell";
import { actorFor, gmSkillList, statsRecord } from "@/features/play/playModel";
import { oppositionFor, type CheckRoll, type PendingCheck } from "@/features/play/checkPrompt";
import type { CampaignEvent } from "@/lib/backend";
import { useLife } from "./useLife";
import { ShopSheet } from "./ShopSheet";
import { RecordSheet } from "./RecordSheet";
import type { LifeActionCard } from "./lifeResponse";

/** Where someone stands with the character, in words rather than a number. */
function dispositionLabel(disposition: number): string {
  if (disposition <= -3) return "hostile";
  if (disposition === -2) return "hates you";
  if (disposition === -1) return "cold";
  if (disposition === 0) return "neutral";
  if (disposition === 1) return "warm";
  if (disposition === 2) return "close";
  return "devoted";
}

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
      return (
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground sm:text-sm sm:leading-relaxed">
          <NpcText text={text} />
        </p>
      );

    case "skill_check":
      return (
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-accent">◆</span> {text}
        </p>
      );
    case "pressure_arrived":
      return (
        <p className="my-1 border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {text}
        </p>
      );
    case "pressure_moved":
      return (
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-destructive">▲</span> {text}
        </p>
      );
    case "oracle_roll":
      // The pacing dice, shown. Seeing "Nobody calls" roll in is what makes a
      // quiet evening read as a fact about the city rather than a lull the
      // narrator chose, so these are deliberately never hidden.
      return (
        <p className="font-mono text-xs text-muted-foreground/80">
          <span className="text-muted-foreground">⚄</span> {text}
        </p>
      );
    case "world_moved":
      return (
        <p className="my-1 border-l-2 border-neon-pink/60 bg-neon-pink/5 px-3 py-2 text-sm text-foreground">
          {text}
        </p>
      );
    case "purchase":
    case "reload":
      return (
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-accent">◆</span> {text}
        </p>
      );
    case "npc_read":
      return (
        <p className="border-l-2 border-neon-pink/60 pl-3 font-mono text-xs text-neon-pink">
          ◆ {text}
        </p>
      );
    case "hook_negotiated":
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
  "hook_negotiated",
  "npc_read",
  // "oracle_roll" is intentionally hidden for now; the raw die results were
  // reading as noise next to the narration. Re-enable here to bring the box back.
  "pressure_moved",
  "pressure_arrived",
  "hook_declined",
  "mission_started",
  "mission_completed",
  // What you bought and what you loaded: short, factual, and the record that
  // the money actually turned into something.
  "purchase",
  "reload",
  // Somebody moved while the character was not looking.
  "world_moved",
]);

/**
 * The running log. The current turn's narration is shown below the input in its
 * own block, so any narration text identical to it is dropped here: the same
 * paragraph twice reads as a bug, because it is one.
 */
function LifeLog({
  events,
  busy,
  suppressText,
}: {
  events: CampaignEvent[];
  busy: boolean;
  suppressText?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);
  const norm = (t: string) => t.replace(/\s+/g, " ").trim();
  const suppressed = suppressText ? norm(suppressText) : null;
  const shown = events
    .filter((e) => LIFE_EVENT_TYPES.has(e.type))
    .filter(
      (e) => !(suppressed && e.type === "life_narration" && norm(e.summary ?? "") === suppressed),
    )
    .slice(-40);
  // One scroller on a phone (the page); the desktop column keeps its own.
  return (
    <div className="space-y-3 border border-border bg-card/40 p-4 lg:flex-1 lg:overflow-y-auto">
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

/** One option, shown only when the player asked: time, money and dice up front. */
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
      {/* Touch has no hover, so the skill hint is spelled out on small screens. */}
      {hint && (
        <span className="num font-mono text-[10px] uppercase tracking-[0.18em] text-neon-pink lg:hidden">
          {hint.name}: {hint.base}
        </span>
      )}
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

/**
 * The offer on the table.
 *
 * Everything shown here is read off the mission this offer will actually start:
 * the title, the broker, the fee, the pitch. Pushing on the terms posts a real
 * check the player rolls on the same card as any other, and the engine decides
 * what it bought.
 */
function HookCard({ life }: { life: ReturnType<typeof useLife> }) {
  const hook = life.hook;
  const [reason, setReason] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  if (!hook) return null;

  const { offer, terms, mission } = hook;
  const raised = terms.payout !== terms.basePayout;
  const learned = knownTerms(terms, offer);
  const asks = openAsks(terms);
  const blocked = life.busy || !!life.pendingCheck;
  const expanded = isOpen && !isClosing;

  return (
    <section className="border border-neon-pink bg-neon-pink/5">
      <Collapsible open={expanded} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 p-4 text-left"
            aria-label="Toggle job offer details"
          >
            <div className="min-w-0 flex-1">
              <Label>Work on the table</Label>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-base font-bold">{mission.title}</h3>
                <p className="text-sm text-muted-foreground">
                  <NpcName name={offer.brokerName} />, {offer.brokerLine}
                </p>
                <p className="num font-mono text-sm">
                  {raised && (
                    <span className="mr-2 text-muted-foreground line-through">
                      {terms.basePayout}eb
                    </span>
                  )}
                  <span className="font-bold text-neon-pink">{terms.payout}eb</span>
                  <span className="ml-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {offer.district}
                  </span>
                </p>
              </div>
            </div>
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              <ChevronDown
                className={`h-5 w-5 transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-4 pb-4">
          <div className="space-y-3">
            <p className="text-sm leading-relaxed">
              <NpcText text={offer.pitch} />
            </p>
            <p className="text-sm">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                They want{" "}
              </span>
              {offer.ask}
            </p>

            {learned.length > 0 && (
              <ul className="space-y-1 border-l-2 border-accent pl-3">
                {learned.map((fact) => (
                  <li key={fact} className="text-sm text-accent">
                    {fact}
                  </li>
                ))}
              </ul>
            )}

            {asks.length > 0 && (
              <div className="space-y-1">
                <Label>Before you answer</Label>
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  {asks.map((spec) => (
                    <Button
                      key={spec.ask}
                      variant="outline"
                      disabled={blocked}
                      title={spec.blurb}
                      onClick={() => life.pushHook(spec.ask)}
                      className="h-auto w-full flex-col items-start gap-1 whitespace-normal py-2 text-left sm:w-auto"
                    >
                      <span className="text-sm font-semibold">{spec.label}</span>
                      <span className="num font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {getSkill(spec.skillId).name} · {formatDuration(spec.minutes)}
                      </span>
                      {/* Hover-only blurbs are invisible on touch, so it is written out here. */}
                      <span className="text-xs font-normal text-muted-foreground sm:hidden">
                        {spec.blurb}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Nothing starts until you say yes. Ask questions, push for more, sleep on it, or walk.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={blocked}
                onClick={() => {
                  setIsClosing(true);
                  life.acceptHook();
                }}
              >
                Take the job
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={blocked}
                onClick={() => {
                  setIsClosing(true);
                  life.declineHook(reason || "Not this one.");
                }}
              >
                Turn it down
              </Button>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="…or say why (optional)"
                className="min-w-[12rem] flex-1 border border-border bg-background px-2 py-1 text-sm"
                disabled={blocked}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

/**
 * The one thing the player always has: a place to say what they do.
 *
 * What they type is sent as what they typed. No engine note is stapled to it,
 * because a nudge about when to roll belongs in the system prompt, not in the
 * player's own words on their own log.
 */
function InputBar({
  onSend,
  onAskOptions,
  busy,
}: {
  onSend: (text: string) => Promise<boolean> | void;
  onAskOptions: () => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const result = await onSend(trimmed);
    if (result !== false) setText("");
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        placeholder="What do you do?"
        rows={2}
        className="flex-1 resize-none"
        disabled={busy}
      />
      <div className="flex gap-2 sm:flex-col">
        <Button
          className="flex-1 sm:flex-none"
          onClick={() => void send()}
          disabled={busy || !text.trim()}
        >
          {busy ? "…" : "Act"}
        </Button>
        <Button
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={onAskOptions}
          disabled={busy}
          title="Ask what you could do here. Costs no time."
        >
          Options?
        </Button>
      </div>
    </div>
  );
}

/**
 * The status rail. Rendered once as a desktop sidebar and once inside the
 * mobile status sheet, so a phone never has to scroll past the whole log to
 * find out how much HP is left.
 */
function LifeRail({
  life,
  bundle,
  luckLeft,
  luckMax,
}: {
  life: ReturnType<typeof useLife>;
  bundle: NonNullable<ReturnType<typeof useLife>["bundle"]>;
  luckLeft: number;
  luckMax: number;
}) {
  return (
    <>
      <section className="space-y-3 border border-border bg-card p-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight">{bundle.character.character.name}</h2>
          <p className="text-sm text-muted-foreground">
            {bundle.character.character.handle ? `"${bundle.character.character.handle}" · ` : ""}
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

      {life.people.length > 0 && (
        <section className="space-y-2 border border-border bg-card p-4">
          <Label>People</Label>
          <ul className="space-y-2">
            {life.people.slice(0, 8).map((person) => (
              <li key={person.key} className="text-sm">
                <span className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                  <span className="truncate font-medium">{person.name}</span>
                  <span className="num shrink-0 font-mono text-[10px] uppercase tracking-[0.16em]">
                    {dispositionLabel(person.disposition)} ({person.disposition})
                  </span>
                </span>
                {person.standing && (
                  <span className="block text-xs text-muted-foreground">{person.standing}</span>
                )}
                {(person.known ?? []).map((fact) => (
                  <span key={fact} className="mt-1 block text-xs text-neon-pink">
                    {fact}
                  </span>
                ))}
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
              <p className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm">
                <span className="truncate">{c.label}</span>
                <span className="num shrink-0 font-mono text-xs text-muted-foreground">
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

      {life.standings.length > 0 && (
        <section className="space-y-2 border border-border bg-card p-4">
          <Label>Standing</Label>
          <ul className="space-y-1">
            {life.standings.map((s) => (
              <li
                key={s.factionId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2"
              >
                <span className="truncate text-sm">{getFaction(s.factionId).name}</span>
                <span
                  className={`num shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] ${
                    isHostile(s.standing) ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {standingBand(s.standing).label} ({s.standing})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecordSheet bundle={bundle} />

      <ShopSheet bundle={bundle} />

      <Button asChild variant="outline" size="sm" className="w-full">
        <Link to="/roster">Back to the roster</Link>
      </Button>
    </>
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

  const chips = [
    { label: "HP", value: `${bundle.vitals.hp_current}/${bundle.vitals.hp_max}` },
    { label: "Wound", value: bundle.vitals.wound_state },
    { label: "eb", value: `${bundle.vitals.eurobucks}` },
    ...(luckMax > 0 ? [{ label: "Luck", value: `${luckLeft}/${luckMax}` }] : []),
  ];

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
      <div className="touch-play">
        <MobileStatusBar title={bundle.character.character.name} chips={chips}>
          <LifeRail life={life} bundle={bundle} luckLeft={luckLeft} luckMax={luckMax} />
        </MobileStatusBar>

        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-3 lg:min-h-[70vh]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 lg:sticky lg:top-0 lg:z-20 lg:-mx-4 lg:border-b lg:border-border lg:bg-background/95 lg:px-4 lg:py-3 lg:backdrop-blur supports-[backdrop-filter]:lg:bg-background/70">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {bundle.campaign.name}
                </h1>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                  Life · {formatLifeClock(bundle.clock)} · day {bundle.clock.day}
                </p>
              </div>
              <SheetDrawer character={bundle.character} inventory={bundle.inventory} />
            </div>

            <LifeLog
              events={bundle.events}
              busy={life.busy}
              {...(life.narration ? { suppressText: life.narration.text } : {})}
            />

            {life.actionError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {life.actionError.message}
              </p>
            )}

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

            {life.narration && (
              <section className="border-l-2 border-accent bg-accent/5 p-3">
                <Label>{life.narration.title}</Label>
                <p className="mt-1 text-[15px] leading-7 sm:text-sm sm:leading-relaxed">
                  {life.narration.text}
                </p>
              </section>
            )}

            {/* Options, and only when they were asked for. An ordinary turn
                returns none, so these clear themselves the moment the player acts. */}
            {!life.pendingCheck && life.actions.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3">
                {life.actions.map((action) => (
                  <ActionCard
                    key={action.label}
                    action={action}
                    character={bundle.character as never}
                    busy={life.busy}
                    onPick={() => void life.act(`${action.label}. ${action.description}`.trim())}
                  />
                ))}
              </div>
            )}

            {life.hook && <HookCard life={life} />}

            <BottomDock>
              <InputBar
                onSend={(text) => life.act(text)}
                onAskOptions={() => life.askOptions()}
                busy={life.busy || !!life.pendingCheck}
              />
            </BottomDock>
          </div>

          <aside className="sticky top-6 hidden h-fit space-y-4 self-start lg:block">
            <LifeRail life={life} bundle={bundle} luckLeft={luckLeft} luckMax={luckMax} />
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
