import { LifeSceneContent } from "./LifeSceneContent";
import type { ReactNode } from "react";
import { readSceneCombatEnd } from "@/engine";
/**
 * LIFE — the screen between jobs. One situation at a time, a free-text box, and
 * a clock that costs something to spend.
 *
 * There is deliberately NO menu. The scene describes what is there; what to do
 * about it is the player's problem. Options exist only if they ask for them,
 * behind a button, and asking costs no time.
 *
 * That included the standing business of the district, which used to sit on
 * screen permanently as a "here you can" strip — a menu by any other name, and
 * one that duplicated the options the model wrote from the same list. It is
 * offered behind the same button now, mixed in with what is live; see
 * lifeOptions.ts. Every card charges the minutes and the eurobucks it prints.
 *
 * A job can only appear here as an offer, with terms the player can push on and
 * an Accept they have to press themselves.
 */
import { useEffect, useMemo, useRef, useState } from "react";
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
  getSkill,
  knownTerms,
  luckModifier,
  luckPoolMax,
  luckRemaining,
  opposedCheckForCharacter,
  openAsks,
  resolveSkillId,
  skillCheckForCharacter,
  DEFAULT_START,
  woundActionPenalty,
  type WoundStateCode,
  placeSignals,
  cityBeats,
  resolvePosition,
  placeActions,
  peopleAtHaunts,
  districtOfPlace,
  whoIsAt,
  flagMeaning,
  getDistrict,
  getPlace,
  isCombatZone,
  partOfDay,
} from "@/engine";

import { NpcText } from "@/features/cast/NpcText";
import { WalkOnStrip } from "@/features/cast/WalkOnStrip";
import { JOB_TIERS, readWalkOnsEventData } from "@/engine";
import { CheckCard } from "@/features/play/CheckCard";
import { MapButton } from "@/features/atlas/MapButton";
import { CampaignHeader } from "@/features/play/CampaignHeader";
import { SheetDrawer } from "@/features/play/SheetDrawer";
import { CharacterCard } from "./hud/CharacterCard";
import { PeopleStrip } from "./hud/PeopleStrip";
import { ResourceStrip } from "./hud/ResourceStrip";
import {
  readDayBrief,
  statusView,
  welcomeBack,
  type StatusView,
} from "@/features/status/statusModel";
import { ReceiptBar } from "@/features/status/ReceiptBar";
import { IpTallyCard } from "@/features/play/IpTallyCard";
import { snapshotOf } from "@/features/status/receipts";
import { useReceipts } from "@/features/status/useReceipts";
import { BottomDock, MobileStatusBar } from "@/features/play/mobileShell";
import {
  actorFor,
  gmSkillList,
  statsRecord,
  type CurrentStatsContext,
} from "@/features/play/playModel";
import { type CheckRoll, type PendingCheck } from "@/features/play/checkPrompt";
import { previewPendingCheck, rollPendingCheck } from "@/features/play/rollCheck";
import { RollLine } from "@/features/play/RollLine";
import type { CampaignEvent } from "@/lib/backend";
import { useLife } from "./useLife";
import { CityTurns } from "./CityTurns";
import { SceneHero } from "./SceneHero";
import type { TurnContext } from "./cityTurnModel";
import { hauntPeople } from "./lifeModel";
import { placeHistory } from "@/features/campaign/placeState";
import { ShopSheet } from "./ShopSheet";
import { RipperdocSheet } from "./RipperdocSheet";
import { WorkshopSheet } from "./WorkshopSheet";
import { RecordSheet } from "./RecordSheet";
import { HomeSheet } from "./HomeSheet";
import { ClimbIntro } from "./ClimbIntro";
import { climbLogLine } from "@/features/campaign/climbNews";
import { WithinReachSheet } from "./WithinReachSheet";
import type { LifeActionCard } from "./lifeResponse";
import { cardInput } from "./lifeOptions";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

type Climber = { roleId: string | null; homeDistrictKey: string | null };
const NO_CLIMBER: Climber = { roleId: null, homeDistrictKey: null };

function LifeEvent({ event, climber }: { event: CampaignEvent; climber?: Climber }) {
  const text = event.summary ?? "";
  if (!text) return null;
  switch (event.type) {
    case "player_input":
      return (
        <p className="border-l-2 border-accent/60 pl-3 text-sm italic text-accent">&gt; {text}</p>
      );
    case "life_narration":
      return (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground sm:text-sm sm:leading-relaxed">
            <NpcText text={text} />
          </p>
          <WalkOnStrip walkOns={readWalkOnsEventData(event.data)} />
        </div>
      );

    case "skill_check":
      return <RollLine event={event} text={text} />;
    case "day_began": {
      const brief = readDayBrief(event.data);
      if (!brief) return null;
      return (
        <div className="my-2 border-l-2 border-accent bg-accent/5 px-3 py-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            Day {brief.day}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-foreground">
            {brief.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      );
    }
    case "pressure_arrived":
      return (
        <p className="my-1 border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {text}
        </p>
      );
    // Something on the climb went up: a Skill, the Rank, a job's worth of name,
    // the points that pay for the next one. Kept in the log, not flashed, so the
    // player can scroll back to the night it happened.
    case "milestone":
    case "skill_raised":
    case "role_rank_raised":
    case "ip_awarded":
      return (
        <p className="my-1 border-l-2 border-accent bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
          <span aria-hidden>▲</span> {climbLogLine(event, climber ?? NO_CLIMBER) ?? text}
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
    case "cyberware_installed":
    case "moved_house":
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
    case "travelled":
      return (
        <p className="font-mono text-xs text-accent">
          <span className="text-accent">➜</span> <NpcText text={text} />
        </p>
      );
    // Something the character tried and could not do. Shown for the same reason
    // a travel line is: without it the prose says they went and the map says
    // they did not, and the player has no way to tell which is true.
    case "action_refused":
      return (
        <p className="font-mono text-xs text-ember">
          <span>✕</span> {text}
        </p>
      );
    case "check_prompt":
      return null;

    default:
      return <p className="font-mono text-xs text-muted-foreground">{text}</p>;
  }
}

const LIFE_EVENT_TYPES = new Set([
  "encounter_ended",
  "player_input",
  "travelled",
  "action_refused",

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
  "cyberware_installed",
  // A new home, or a new Lifestyle: the deposit and the new monthly bill.
  "moved_house",
  // The climb: what went up, and what paid for it.
  "milestone",
  "skill_raised",
  "role_rank_raised",
  "ip_awarded",
  // Somebody moved while the character was not looking.
  "world_moved",
  // A new day, and what is waiting in it.
  "day_began",
]);

/**
 * What the log actually shows: the Life event types, minus the narration that
 * is already printed in its own block below the input.
 *
 * Shared, because the screen has to ask the same question the log answers — an
 * opening with nothing in it is what puts the scene picture at full height, and
 * a second copy of this filter would drift from the first the day one of the
 * event types moves.
 */
function shownLifeEvents(events: CampaignEvent[], suppressText?: string): CampaignEvent[] {
  const norm = (t: string) => t.replace(/\s+/g, " ").trim();
  const suppressed = suppressText ? norm(suppressText) : null;
  return events
    .filter(
      (e) =>
        LIFE_EVENT_TYPES.has(e.type) &&
        (e.type !== "encounter_ended" || readSceneCombatEnd(e.data)),
    )
    .filter(
      (e) =>
        !(
          suppressed &&
          (e.type === "life_narration" || e.type === "encounter_ended") &&
          norm(e.summary ?? "") === suppressed
        ),
    )
    .slice(-40);
}

/**
 * The running log. The current turn's narration is shown below the input in its
 * own block, so any narration text identical to it is dropped here: the same
 * paragraph twice reads as a bug, because it is one.
 */
function LifeLog({
  events,
  suppressText,
  climber,
  autoScroll = true,
}: {
  events: CampaignEvent[];
  autoScroll?: boolean;
  suppressText?: string;
  climber?: Climber;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length, autoScroll]);
  const shown = shownLifeEvents(events, suppressText);
  // Nothing has happened yet: the scene above is the screen, and an empty
  // bordered box under it reads as something that failed to load. The wait
  // itself is no longer this component's problem — it renders once, at the
  // bottom of the screen, above the input, rather than at the tail of
  // whatever this box happens to hold.
  if (shown.length === 0) return null;
  // One scroller on a phone (the page); the desktop column keeps its own.
  return (
    <div className="space-y-3 border border-border bg-card/40 p-4 lg:flex-1 lg:overflow-y-auto">
      {shown.map((e) => (
        <LifeEvent key={e.id} event={e} {...(climber ? { climber } : {})} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

/** One option, shown only when the player asked: time, money and dice up front. */
function ActionCard({
  action,
  character,
  context,
  onPick,
  busy,
}: {
  action: LifeActionCard;
  character: ReturnType<typeof useLife>["bundle"] extends infer B
    ? B extends { character: infer C }
      ? C
      : never
    : never;
  /**
   * The live context the roll will use: worn armor, current Humanity, and the
   * district underfoot. The card prints the number the engine is going to add,
   * so it has to be asked the same question the check asks — without the
   * district, a Local Expert option advertised a Level the character only has
   * in another neighbourhood.
   */
  context: CurrentStatsContext;
  onPick: () => void;
  busy: boolean;
}) {
  const skillId = action.skillId ? resolveSkillId(action.skillId) : null;
  const line = skillId
    ? gmSkillList(character as never, 40, context).find((s) => s.id === skillId)
    : undefined;
  const hint = skillId
    ? {
        // The engine's own label, which names the specialization — and for
        // Local Expert, the district this number is for.
        name: line?.skill ?? getSkill(skillId).name,
        base: line?.base ?? 0,
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
  const [passed, setPassed] = useState(false);
  if (!hook && !passed) return null;
  if (!hook) return null;

  const { offer, terms, mission } = hook;
  const raised = terms.payout !== terms.basePayout;
  const learned = knownTerms(terms, offer);
  const asks = openAsks(terms);
  const blocked = life.busy || !!life.pendingCheck;
  const expanded = isOpen && !isClosing && !passed;

  if (passed) {
    return (
      <section className="border border-neon-pink/40 bg-neon-pink/5 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Passed on <span className="font-semibold text-foreground">{mission.title}</span>
        </p>
      </section>
    );
  }

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
                  {offer.brokerName}, {offer.brokerLine}
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
                  setPassed(true);
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
  /** Open the city and pick a destination off it. */
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
  status,
  intro = true,
}: {
  life: ReturnType<typeof useLife>;
  bundle: NonNullable<ReturnType<typeof useLife>["bundle"]>;
  luckLeft: number;
  luckMax: number;
  status: StatusView;
  /** False where the screen shows the day-one pointer itself (a phone). */
  intro?: boolean;
}) {
  const [reachOpen, setReachOpen] = useState(false);
  return (
    <>
      <CharacterCard
        name={bundle.character.character.name}
        handle={bundle.character.character.handle}
        role={bundle.character.character.role}
        portraitPath={bundle.character.character.portrait_path}
        portraitId={bundle.character.character.portrait_id}
        hp={{ current: bundle.vitals.hp_current, max: bundle.vitals.hp_max }}
        humanity={{ current: bundle.vitals.humanity_current, max: bundle.vitals.humanity_max }}
        luck={{ left: luckLeft, max: luckMax }}
        wound={bundle.vitals.wound_state}
      />

      {/*
       * Where they stand, as three chips: what rent is doing, what the banked
       * points are close to buying, and what they have taken on. The detail
       * waits behind each one rather than standing open down the rail.
       */}
      <ResourceStrip status={status} />

      <PeopleStrip people={life.people} standings={life.standings} />

      {intro && (
        <ClimbIntro
          campaignId={bundle.campaign.id}
          pinnedCount={life.pinned.length}
          onShow={() => setReachOpen(true)}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <WithinReachSheet life={life} open={reachOpen} onOpenChange={setReachOpen} />
        <RecordSheet bundle={bundle} />
        <HomeSheet life={life} />
        <ShopSheet bundle={bundle} />
        <RipperdocSheet bundle={bundle} narrate={life.narrateFixedResult} />
        {/* Renders nothing at all for a character without Maker. */}
        <WorkshopSheet bundle={bundle} />
      </div>

      <Link
        to="/roster"
        className="block text-center font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim hover:text-foreground"
      >
        Back to the roster
      </Link>
    </>
  );
}

/** The places this campaign has actually been, as written on the campaign row. */
function knownPlacesOf(campaign: { known_places: unknown }): string[] {
  return Array.isArray(campaign.known_places)
    ? (campaign.known_places as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
}

export function LifeScreen({
  campaignId,
  sceneControls,
}: {
  campaignId: string;
  sceneControls?: ReactNode;
}) {
  const life = useLife(campaignId);
  const bundle = life.bundle;
  const [mobileReachOpen, setMobileReachOpen] = useState(false);

  /**
   * What the last turn cost.
   *
   * Diffed across bundles rather than read from a row: every one of these
   * numbers was already moved by the turn and written down, and none of them
   * was ever shown as a CHANGE. Called above the loading and error returns
   * below, because hooks do not get to be conditional.
   */
  const receipts = useReceipts(
    bundle
      ? snapshotOf({
          clock: bundle.clock,
          vitals: bundle.vitals,
          npcs: bundle.npcs,
          pressure: bundle.pressure,
          goals: life.pinned,
          climb: {
            reputation: bundle.climb.reputation.level,
            tierIndex: JOB_TIERS.findIndex((t) => t.id === bundle.climb.tier.tier.id),
            tierName: bundle.climb.tier.tier.name,
          },
        })
      : null,
  );

  // What is worth knowing about somewhere tonight. The engine applies the
  // budget: three across the whole city, one per district, each tracing to a
  // row. Most pins carry nothing, which is the intended reading.
  const signals = useMemo(() => {
    if (!bundle) return [];
    // What the character is standing in the middle of, plus what is on in the
    // districts they know. The second half is not persisted and does not need
    // to be: the derivation is deterministic, so the city can be asked what it
    // is doing tonight without anything being written down.
    const known = new Set<string>();
    for (const raw of knownPlacesOf(bundle.campaign)) {
      const at = resolvePosition(raw);
      if (at) known.add(at.districtKey);
    }
    return placeSignals({
      // People you know, where they actually are tonight. Derived rather than
      // stored, and filtered to districts the character knows on the same rule
      // as the beats: somebody drinking in a neighbourhood you have never been
      // to is not news that reaches you.
      peopleAt: peopleAtHaunts({
        people: hauntPeople(
          bundle.npcs,
          bundle.campaign,
          bundle.character.finance?.home_district_key,
          bundle.places,
        ),
        day: bundle.clock.day,
        minute: bundle.clock.minute,
        seed: bundle.campaign.id,
      }).filter((p) => {
        const at = districtOfPlace(p.placeKey);
        return at ? known.has(at.key) : false;
      }),
      situations: [
        ...bundle.situations,
        ...cityBeats({
          districtKeys: [...known],
          day: bundle.clock.day,
          minute: bundle.clock.minute,
          seed: bundle.campaign.id,
          // A market the law has closed does not light a pin saying it is on.
          places: bundle.places,
        }),
      ],
    });
  }, [bundle]);

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

  /**
   * Where the player stands, derived from rows this screen already holds.
   *
   * Life carries no mission runtime, so no objectives are passed: in Life the
   * commitments are the situations and the clocks. Play passes its own.
   */
  const status = statusView({
    campaign: bundle.campaign,
    vitals: bundle.vitals,
    character: bundle.character,
    situations: life.situations,
    clocks: life.clocks,
    currentKey: life.situation?.key ?? null,
    pinned: life.pinned,
  });

  // Read at render rather than held in a hook: this sits after the screen's
  // early returns, and the card should vanish the moment they act anyway —
  // their own turn makes the newest event recent.
  const returning = welcomeBack(bundle.events.at(-1)?.created_at, Date.now(), status.commitments);

  /**
   * The live context every number on this screen is read through: worn armor,
   * current Humanity, and the district under the character's feet. A Local
   * Expert check is about the neighbourhood they are standing in, so the
   * district travels with the rest of it.
   */
  const rollContext: CurrentStatsContext = {
    vitals: bundle.vitals,
    inventory: bundle.inventory,
    districtKey:
      resolvePosition(bundle.campaign.location_key ?? DEFAULT_START)?.districtKey ?? null,
  };

  const locationKey = bundle.campaign.location_key ?? DEFAULT_START;
  const hasLog = shownLifeEvents(bundle.events, life.narration?.text).length > 0;

  /**
   * What the wait is allowed to know: where they are, and roughly when. Three
   * map lookups, computed inline rather than memoised — this sits after the
   * screen's early returns, where a hook cannot go.
   */
  const turnContext: TurnContext = (() => {
    const at = resolvePosition(locationKey);
    const district = at ? getDistrict(at.districtKey) : undefined;
    const place = at?.placeKey ? getPlace(at.placeKey) : undefined;
    return {
      dayPart: partOfDay(bundle.clock.minute),
      ...(district ? { districtName: district.name, combatZone: isCombatZone(district.key) } : {}),
      ...(place ? { placeName: place.name } : {}),
    };
  })();

  const chips = [
    { label: "HP", value: `${bundle.vitals.hp_current}/${bundle.vitals.hp_max}` },
    { label: "Wound", value: bundle.vitals.wound_state },
    { label: "eb", value: `${bundle.vitals.eurobucks}` },
    ...(luckMax > 0 ? [{ label: "Luck", value: `${luckLeft}/${luckMax}` }] : []),
  ];

  /** The engine rolls; the card only animates toward what it rolled. */
  const rollCheck = (pending: PendingCheck, luckSpend: number): CheckRoll =>
    rollPendingCheck({
      campaign: bundle.campaign,
      character: bundle.character,
      vitals: bundle.vitals,
      inventory: bundle.inventory,
      pending,
      luckSpend,
    });

  /** The chance of the same check, built from the same inputs as the roll. */
  const checkOdds = (pending: PendingCheck, luckSpend: number) =>
    previewPendingCheck({
      campaign: bundle.campaign,
      character: bundle.character,
      vitals: bundle.vitals,
      inventory: bundle.inventory,
      pending,
      luckSpend,
    });

  const knownPlaces = knownPlacesOf(bundle.campaign);

  /**
   * Everything the campaign knows about a place, for the dossier's live panels.
   *
   * Assembled from rows that already exist: the campaign's place row for what
   * has happened there, haunts for who is in, the location's own tags for what
   * is open, and the ledger for what the character has done. Nothing here is
   * generated and nothing here asks the model anything.
   */
  const placeHere = (key: string) => {
    if (!bundle) return undefined;
    const state = bundle.places[key];
    const met = whoIsAt({
      placeKey: key,
      people: hauntPeople(
        bundle.npcs,
        bundle.campaign,
        bundle.character.finance?.home_district_key,
        bundle.places,
      ),
      day: bundle.clock.day,
      minute: bundle.clock.minute,
      seed: bundle.campaign.id,
    });
    const district = districtOfPlace(key);
    const business = district
      ? placeActions({ districtKey: district.key, placeKey: key, places: bundle.places })
          // What this place DOES. A way of looking at it is not its business,
          // and this panel is a page about the location rather than a list of
          // things to press.
          .filter((a) => a.placeKey === key && !a.skillId)
          .map((a) => ({
            label: a.label,
            detail: `${formatDuration(a.minutes)}${a.cost ? ` · ${a.cost}eb` : ""}`,
          }))
      : [];
    const since = state?.lastVisitDay != null ? bundle.clock.day - state.lastVisitDay : null;
    return {
      conditions: (state?.flags ?? []).map((flag) => flagMeaning(flag) ?? flag),
      people: met ? [met.name] : [],
      business,
      history: placeHistory(bundle.events, key),
      visits: state?.visits ?? 0,
      ...(since !== null
        ? {
            lastVisit:
              since === 0
                ? "You were here today."
                : since === 1
                  ? "Last visit: yesterday."
                  : `Last visit: ${since} days ago.`,
          }
        : {}),
    };
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="touch-play">
        <MobileStatusBar title={bundle.character.character.name} chips={chips}>
          <LifeRail
            life={life}
            bundle={bundle}
            luckLeft={luckLeft}
            luckMax={luckMax}
            status={status}
            intro={false}
          />
        </MobileStatusBar>
        {/* On a phone the rail waits behind the status bar, so the day-one
            pointer stands in the column and opens Within reach itself. */}
        <div className="px-4 lg:hidden [&>section]:mt-3">
          <ClimbIntro
            campaignId={bundle.campaign.id}
            pinnedCount={life.pinned.length}
            onShow={() => setMobileReachOpen(true)}
          />
          <WithinReachSheet
            life={life}
            open={mobileReachOpen}
            onOpenChange={setMobileReachOpen}
            trigger={false}
          />
        </div>

        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-3 lg:min-h-[70vh]">
            <CampaignHeader
              title={bundle.campaign.name}
              subtitle={
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                  Life · {formatLifeClock(bundle.clock)} · day {bundle.clock.day}
                </p>
              }
              className="lg:sticky lg:top-0 lg:z-20 lg:bg-background/95 lg:backdrop-blur supports-[backdrop-filter]:lg:bg-background/70"
              actions={
                <>
                  <MapButton
                    locationKey={bundle.campaign.location_key ?? DEFAULT_START}
                    knownPlaces={knownPlaces}
                    onTravel={life.travelTo}
                    travelBusy={life.travelBusy}
                    {...(life.vehicleRule ? { travelMode: life.vehicleRule } : {})}
                    signals={signals}
                    placeHere={placeHere}
                  />
                  <SheetDrawer
                    character={bundle.character}
                    inventory={bundle.inventory}
                    cyberware={bundle.cyberware}
                  />
                </>
              }
            />

            {/* Coming back after a while: the threads they left open, by name. */}
            {returning && (
              <div className="border-l-2 border-accent bg-accent/5 px-3 py-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                  Where you left off
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                  {returning.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Where you are, before anything has happened here. */}
            <SceneHero locationKey={locationKey} opening={!hasLog} />

            {/* What the turn just cost, alongside the current scene. */}
            <ReceiptBar receipts={receipts} />

            {/* A week of life with no award is a session: judged here, on the
                playstyle columns, the same table a job is judged on. */}
            {life.phase === "life" && (life.ipDaysUntil === 0 || life.lifeIpTally) && (
              <IpTallyCard
                heading="a week on the street, since the last award"
                tally={life.lifeIpTally}
                busy={life.lifeIpBusy}
                error={life.lifeIpError}
                defaults={life.ipLastPlaystyles}
                onTally={life.tallyLifeIp}
                onDismiss={life.dismissLifeIp}
              />
            )}

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
                odds={(luckSpend) => checkOdds(life.pendingCheck!, luckSpend)}
                onSettled={(rolled) => life.commitCheck(life.pendingCheck!, rolled)}
                busy={life.checkBusy}
                luckRemaining={luckLeft}
              />
            )}

            <LifeSceneContent
              narration={
                life.narration ? (
                  <section className="space-y-2 border-l-2 border-accent bg-accent/5 p-3">
                    <Label>{life.narration.title}</Label>
                    <p className="whitespace-pre-wrap text-[15px] leading-7 sm:text-sm sm:leading-relaxed">
                      <NpcText text={life.narration.text} />
                    </p>
                    <WalkOnStrip walkOns={life.narration.walkOns} defaultOpen />
                  </section>
                ) : null
              }
              controls={sceneControls}
              history={
                hasLog ? (
                  <LifeLog
                    autoScroll={!life.narration}
                    events={bundle.events}
                    climber={{
                      roleId: bundle.character.character.role ?? null,
                      homeDistrictKey: bundle.character.finance?.home_district_key ?? null,
                    }}
                    {...(life.narration ? { suppressText: life.narration.text } : {})}
                  />
                ) : null
              }
            />

            {/* Options, and only when they were asked for. An ordinary turn
                returns none, so these clear themselves the moment the player acts. */}
            {!life.pendingCheck && life.actions.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3">
                {life.actions.map((action) => (
                  <ActionCard
                    key={action.label}
                    action={action}
                    character={bundle.character as never}
                    context={rollContext}
                    busy={life.busy}
                    onPick={() =>
                      void life.act(cardInput(action), {
                        // What the card printed is what the turn costs. Both
                        // kinds of card go through here — the model's and the
                        // engine's — because a player cannot tell them apart
                        // and should not have to.
                        minutes: action.timeMinutes,
                        ...(action.knownCost
                          ? { spend: { amount: action.knownCost, reason: action.label } }
                          : {}),
                      })
                    }
                  />
                ))}
              </div>
            )}

            {life.hook && <HookCard life={life} />}

            {/* The wait, pinned above the input rather than at the tail of
                whatever box it used to share — the lowest thing on the
                screen until the turn actually lands. */}
            {life.busy && <CityTurns context={turnContext} seed={bundle.events.length} />}

            <BottomDock>
              <InputBar
                onSend={(text) => life.act(text)}
                onAskOptions={() => life.askOptions()}
                busy={life.busy || !!life.pendingCheck}
              />
            </BottomDock>
          </div>

          <aside className="sticky top-6 hidden h-fit space-y-4 self-start lg:block">
            <LifeRail
              life={life}
              bundle={bundle}
              luckLeft={luckLeft}
              luckMax={luckMax}
              status={status}
            />
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
