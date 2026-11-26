import { LucyOffer } from "./LucyOffer";
import { NeighborhoodCard } from "./NeighborhoodCard";
import { neighborhoodContext } from "./neighborhoodOps";
import { clinicDescription, CLINIC_PLACE } from "@/engine/neighborhood";
import { LifeSceneContent } from "./LifeSceneContent";
import { AgentCallStrip } from "./AgentCallStrip";
import { LifeComposer } from "./LifeComposer";
import { sceneArt } from "./sceneArt";
import { NCAmp } from "@/features/music/ncamp/NCAmp";
import type { ReactNode } from "react";
import {
  AGENT_CALL_ENDED,
  FIXER_VENDOR,
  readAgentCallEventData,
  readSceneCombatEnd,
  shopsAt,
} from "@/engine";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChevronDown, ShoppingBag } from "lucide-react";
import {
  NIGHT_AT_THE_OPERA,
  formatLifeClock,
  clampLuckSpend,
  formatDuration,
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
import { castHere } from "./lifeContextOps";
import { SceneFaces } from "./SceneFaces";
import { sceneFaces } from "./sceneFaceModel";
import { JOB_TIERS, readWalkOnsEventData } from "@/engine";
import { LifeCheckCard, LifeCheckResult } from "./LifeCheckCard";
import {
  currentLifeRoll,
  lifeCheckAnnouncement,
  lifeRollOutcome,
  readLifeRoll,
} from "./lifeCheckView";
import { PreviouslyCard } from "@/features/play/ClosingFrameCard";
import { previouslyFor, readDismissed, writeDismissed } from "@/features/campaign/previously";
import { MapButton } from "@/features/atlas/MapButton";
import { carriedKit } from "@/features/play/carriedKit";
import { SheetDrawer } from "@/features/play/SheetDrawer";
import { CharacterCard } from "./hud/CharacterCard";
import { PeopleStrip } from "./hud/PeopleStrip";
import { ResourceStrip } from "./hud/ResourceStrip";
import {
  formatMoney,
  readDayBrief,
  statusView,
  welcomeBack,
  type StatusView,
} from "@/features/status/statusModel";
import { ReceiptBar } from "@/features/status/ReceiptBar";
import { IpTallyCard } from "@/features/play/IpTallyCard";
import { snapshotOf } from "@/features/status/receipts";
import { useReceipts } from "@/features/status/useReceipts";
import { MobileStatusBar } from "@/features/play/mobileShell";
import {
  actorFor,
  gmSkillList,
  statsRecord,
  type CurrentStatsContext,
} from "@/features/play/playModel";
import { type CheckRoll, type PendingCheck } from "@/features/play/checkPrompt";
import { previewPendingCheck, rollPendingCheck } from "@/features/play/rollCheck";
import { RollLine } from "@/features/play/RollLine";
import type { CampaignEvent, FullCharacter } from "@/lib/backend";
import { useLife } from "./useLife";
import { CityTurns } from "./CityTurns";
import { SceneHero } from "./SceneHero";
import type { TurnContext } from "./cityTurnModel";
import { hauntPeople } from "./lifeModel";
import { placeHistory } from "@/features/campaign/placeState";
import { ShopView } from "./shop/ShopView";
import { browseLinkFor, newestBrowse } from "./browseIntent";
import { standingAt } from "@/features/campaign/favours";
import { DockTile } from "./hud/DockTile";
import { RipperdocSheet } from "./RipperdocSheet";
import { WorkshopSheet } from "./WorkshopSheet";
import { ScreamsheetSheet } from "./ScreamsheetSheet";
import { RecordSheet } from "./RecordSheet";
import { FavoursSheet } from "./FavoursSheet";
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

function LifeEvent({
  event,
  climber,
  here = null,
  onBrowse,
}: {
  event: CampaignEvent;
  climber?: Climber;
  /** The atlas place the character is standing in, for the lines that offer a counter. */
  here?: string | null;
  onBrowse?: ((vendorId: string) => void) | undefined;
}) {
  const text = event.summary ?? "";
  if (!text) return null;
  // An arrival somewhere that sells, or a look at a counter, offers the counter
  // again while they are still standing there.
  const seller = onBrowse ? browseLinkFor(event, here) : null;
  const browse = seller ? (
    <>
      {" "}
      <button
        type="button"
        onClick={() => onBrowse?.(seller)}
        className="ml-1 inline-flex items-center gap-1 border border-accent/50 px-1.5 py-0.5 align-middle font-mono text-[10px] uppercase tracking-[0.18em] text-accent hover:bg-accent/10"
      >
        <ShoppingBag aria-hidden className="size-3" />
        {event.type === "travelled" ? "Browse" : "Back to the counter"}
      </button>
    </>
  ) : null;
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
    case "sold":
    case "reload":
    case "cyberware_installed":
    case "moved_house":
    case "favour_called":
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
          {browse}
        </p>
      );
    case "shop_browsed":
      return (
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-accent">◆</span> {text}
          {browse}
        </p>
      );
    // Something the character tried and could not do. Shown for the same reason
    // a travel line is: without it the prose says they went and the map says
    // they did not, and the player has no way to tell which is true.
    case "inventory_changed":
      return (
        <p role="status" className="font-mono text-xs text-accent">
          {text}
        </p>
      );
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
  AGENT_CALL_ENDED,
  "neighborhood_action",
  "encounter_ended",
  "player_input",
  "travelled",
  "action_refused",
  // They asked to see what a seller has; the counter opened on it.
  "shop_browsed",

  "life_narration",
  "life_action",
  "inventory_changed",
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
  "sold",
  "reload",
  "cyberware_installed",
  // A new home, or a new Lifestyle: the deposit and the new monthly bill.
  "moved_house",
  // A place that was glad to see them did something about it.
  "favour_called",
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
  here = null,
  onBrowse,
}: {
  events: CampaignEvent[];
  suppressText?: string;
  climber?: Climber;
  here?: string | null;
  onBrowse?: ((vendorId: string) => void) | undefined;
}) {
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
        <LifeEvent
          key={e.id}
          event={e}
          here={here}
          onBrowse={onBrowse}
          {...(climber ? { climber } : {})}
        />
      ))}
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
  character: FullCharacter;
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
    ? gmSkillList(character, character.skills.length, context).find((s) => s.id === skillId)
    : undefined;
  const hint = skillId
    ? {
        // The engine's own label, which names the specialization — and for
        // Local Expert, the district this number is for.
        name: line?.skill ?? getSkill(skillId).name,
        base: line?.base,
      }
    : null;

  return (
    <button type="button" className="life-suggestion" disabled={busy} onClick={onPick}>
      <span>
        {action.label}
        {action.description && <small>{action.description}</small>}
      </span>
      <span>
        {[
          formatDuration(action.timeMinutes),
          action.knownCost ? action.knownCost + "eb" : "",
          hint ? hint.name + (hint.base === undefined ? "" : " +" + hint.base) : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </button>
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
  journal,
  onOpenShop,
}: {
  life: ReturnType<typeof useLife>;
  bundle: NonNullable<ReturnType<typeof useLife>["bundle"]>;
  luckLeft: number;
  luckMax: number;
  status: StatusView;
  /** History and neighborhood leads, with a way to return to the scene. */
  journal: (close: () => void) => ReactNode;
  /** Turn the main column into the shop (the Counter). */
  onOpenShop: () => void;
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

      <ClimbIntro
        campaignId={bundle.campaign.id}
        pinnedCount={life.pinned.length}
        onShow={() => setReachOpen(true)}
      />
      <nav className="life-rail-nav" aria-label="Campaign">
        <SheetDrawer
          label="Character"
          character={bundle.character}
          inventory={bundle.inventory}
          cyberware={bundle.cyberware}
        />
        <PeopleStrip people={life.people} standings={life.standings} />
        <RecordSheet bundle={bundle} journal={journal} />
        <ScreamsheetSheet bundle={bundle} />
      </nav>
      <details className="life-tools">
        <summary>Tools and services</summary>
        <WithinReachSheet life={life} open={reachOpen} onOpenChange={setReachOpen} />
        <HomeSheet life={life} />
        {/* Renders nothing unless the place you are standing in has taken to you. */}
        <FavoursSheet bundle={bundle} />
        <DockTile icon={<ShoppingBag className="size-6" />} label="Shop" onClick={onOpenShop} />
        <RipperdocSheet
          bundle={bundle}
          narrate={life.narrateFixedResult}
          onTravel={life.travelTo}
          travelBusy={life.travelBusy}
          travelMode={life.vehicleRule}
        />
        {/* Renders nothing at all for a character without Maker. */}
        <WorkshopSheet bundle={bundle} />
      </details>

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

export function LifeScreen(props: { campaignId: string; sceneControls?: ReactNode }) {
  return <CampaignLife key={props.campaignId} {...props} />;
}

function CampaignLife({
  campaignId,
  sceneControls,
}: {
  campaignId: string;
  sceneControls?: ReactNode;
}) {
  const life = useLife(campaignId);
  const bundle = life.bundle;
  const lucyHook = life.hook?.missionId === NIGHT_AT_THE_OPERA.id ? life.hook : null;
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState("");
  const sending = useRef(false);
  const send = async (input: string, card?: LifeActionCard) => {
    if (sending.current || life.busy || !input.trim()) return;
    sending.current = true;
    setSubmitted(card?.label ?? input);
    try {
      const result = await life.act(
        input,
        card
          ? {
              minutes: card.timeMinutes,
              ...(card.knownCost ? { spend: { amount: card.knownCost, reason: card.label } } : {}),
            }
          : undefined,
      );
      if (result === true && !card) setDraft("");
    } finally {
      sending.current = false;
      setSubmitted("");
    }
  };
  const call = life.agentCall;
  const hangUp = async (keyboard: boolean) => {
    if (!call || sending.current || life.busy) return;
    sending.current = true;
    try {
      await life.hangUp(call.contactKey);
      if (keyboard) document.getElementById("life-intent")?.focus();
    } catch {
      // useLife displays the save error and keeps the call available for retry.
    } finally {
      sending.current = false;
    }
  };
  // The Counter: a shop takes the main column, in place of the scene, until the
  // player leaves it. The phone's status sheet is closed so the shop is what
  // they see.
  const [shopOpen, setShopOpen] = useState(false);
  /** The seller the Counter opens on, when the story or a log line chose one. */
  const [shopVendor, setShopVendor] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const returnFromShop = useRef<{ scroll: number; target: string } | null>(null);
  const shopHeading = useRef<HTMLDivElement>(null);
  const openShop = (vendorId: string | null = null) => {
    returnFromShop.current = {
      scroll: window.scrollY,
      target: document.activeElement?.id === "life-browse" ? "life-browse" : "life-intent",
    };
    setStatusOpen(false);
    setShopVendor(vendorId);
    setShopOpen(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    if (!returnFromShop.current) return;
    if (shopOpen) {
      shopHeading.current?.focus({ preventScroll: true });
    } else {
      const { scroll, target } = returnFromShop.current;
      returnFromShop.current = null;
      document.getElementById(target)?.focus({ preventScroll: true });
      window.scrollTo({ top: scroll, behavior: "instant" });
    }
  }, [shopOpen]);
  const landedSummary = useRef<HTMLDivElement>(null);
  const restoreRollFocus = useRef(false);
  useEffect(() => {
    if (restoreRollFocus.current && landedSummary.current) {
      restoreRollFocus.current = false;
      landedSummary.current.focus({ preventScroll: true });
    }
  }, [life.checkAttempt]);
  // Who sells where the character stands, for the switch above the scene. A
  // trip away from the shop closes the Counter: it belongs to where they were.
  const standing = bundle ? standingAt(bundle.campaign) : null;
  const sellerHere = standing ? (shopsAt(standing)[0] ?? null) : null;
  const lastStanding = useRef(standing);
  useEffect(() => {
    if (lastStanding.current !== standing && shopOpen && shopVendor !== FIXER_VENDOR.id) {
      setShopOpen(false);
    }
    lastStanding.current = standing;
  }, [standing, shopOpen, shopVendor]);
  // "What have you got?" opens the Counter on its own. The turn writes a
  // shop_browsed row when the engine found a seller to show; the newest one
  // seen when the screen first loaded is remembered, so a reload never
  // reopens an old visit and only a turn taken here opens the shop.
  const browsed = bundle ? newestBrowse(bundle.events) : null;
  const seenBrowse = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!bundle) return;
    if (seenBrowse.current === undefined) {
      seenBrowse.current = browsed?.eventId ?? null;
      return;
    }
    if (browsed && browsed.eventId !== seenBrowse.current) {
      seenBrowse.current = browsed.eventId;
      openShop(browsed.vendorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, browsed?.eventId]);
  useEffect(() => {
    if (!shopOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) setShopOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shopOpen]);
  // Which job's "Previously" this browser has put away. Read when the screen
  // first draws, so a card already put away never flashes back for a frame; it
  // is a per-viewer convenience held in storage that may be absent or blocked
  // (`readDismissed` answers null then, and the card simply shows again).
  const [dismissedFrame, setDismissedFrame] = useState<string | null>(() =>
    readDismissed(campaignId),
  );
  useEffect(() => {
    setDismissedFrame(readDismissed(campaignId));
  }, [campaignId]);

  /**
   * What the last turn cost.
   *
   * Diffed across bundles rather than read from a row: every one of these
   * numbers was already moved by the turn and written down, and none of them
   * was ever shown as a CHANGE. Called above the loading and error returns
   * below, because hooks do not get to be conditional.
   */
  const inventoryRefusals = (() => {
    const rows: CampaignEvent[] = [];
    for (const event of [...(bundle?.events ?? [])].reverse()) {
      if (event.type === "player_input") break;
      if (
        event.type === "action_refused" &&
        (event.data as { code?: unknown } | null)?.code === "inventory_unavailable"
      )
        rows.push(event);
    }
    return rows.reverse();
  })();
  const receipts = useReceipts(
    bundle
      ? snapshotOf({
          clock: bundle.clock,
          vitals: bundle.vitals,
          inventory: carriedKit(bundle.inventory).flatMap((group) =>
            group.lines.map((line) => ({
              key: `${group.kind}:${line.itemId}`,
              name: line.name,
              quantity: line.quantity,
            })),
          ),
          npcs: bundle.npcs,
          pressure: bundle.pressure,
          goals: life.pinned,
          climb: {
            reputation: bundle.climb.reputation.level,
            tierIndex: JOB_TIERS.findIndex((t) => t.id === bundle.climb.tier.tier.id),
            tierName: bundle.climb.tier.tier.name,
          },
          sheet: bundle.sheet,
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
    if (!bundle || lucyHook || life.busy || life.actionError) return;
    if (life.narration || life.pendingCheck) return;
    const last = bundle.events.at(-1)?.type;
    if (life.atNeighborhoodScene || last === "neighborhood_action" || last === "travelled") return;
    const key = `${bundle.campaign.id}:${bundle.clock.day}`;
    if (opened.current === key) return;
    opened.current = key;
    life.openMoment();
  }, [bundle, life, lucyHook]);

  if (life.isPending) {
    return <p className="p-8 text-sm text-muted-foreground">Loading your life…</p>;
  }
  if (!bundle && life.error)
    return <p className="p-8 text-sm text-destructive">{life.error.message}</p>;
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
  // How the last job closed, until the player does anything or puts it away.
  const previously = previouslyFor({
    latest: bundle.lastFrame,
    events: bundle.events,
    dismissedId: dismissedFrame,
  });

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
  // Who is in the scene, as faces: the people this passage names (when the
  // engine has them here) and the walk-ons it tagged. A place's usual roles
  // that the passage never brings in are not shown.
  const speaker = call?.name ?? readAgentCallEventData(life.narration?.event.data)?.name;
  const localPerson = castHere(bundle);
  const faces = sceneFaces({
    text: life.narration?.text ?? "",
    walkOns: life.narration?.walkOns.filter((person) => person.name !== speaker || !speaker) ?? [],
    present: localPerson && localPerson.name !== speaker ? [localPerson.name] : [],
    people: life.people,
  });
  const latestRoll = currentLifeRoll(bundle.events);
  const attempt = life.checkAttempt;
  const activeAttempt =
    attempt &&
    (life.checkBusy ||
      life.pendingCheck?.eventId === attempt.pending.eventId ||
      latestRoll?.promptId === attempt.pending.eventId)
      ? attempt
      : null;
  const recovered = life.checkSettlement?.saved;
  const saved =
    activeAttempt && latestRoll?.promptId !== activeAttempt.pending.eventId
      ? recovered
        ? readLifeRoll(recovered)
        : null
      : latestRoll;
  const checkResult = saved?.roll ?? activeAttempt?.roll;
  const resultPrompt = saved?.promptId ?? activeAttempt?.pending.eventId;
  const outcome = saved ? lifeRollOutcome(saved, bundle.events) : undefined;
  const unresolved = !!activeAttempt && !saved && !life.checkBusy;
  const settlement = activeAttempt ? life.checkSettlement : undefined;
  const canRoll = life.pendingCheck?.eventId !== resultPrompt ? life.pendingCheck : null;
  // Keep the setup passage in its original place when the answer arrives below the die.
  const setup =
    outcome && saved
      ? bundle.events
          .filter((event) => event.type === "life_narration" && event.seq < saved.event.seq)
          .at(-1)
      : undefined;
  const passage =
    outcome && life.narration?.event.id === outcome.id
      ? setup
        ? {
            title: (setup.data as { title?: string } | null)?.title ?? "",
            text: setup.summary ?? "",
          }
        : null
      : life.narration;
  const resultStatus = outcome
    ? null
    : life.checkBusy
      ? "Resolving the outcome…"
      : unresolved
        ? settlement?.state === "unsaved"
          ? "The roll could not be saved."
          : "The roll could not be verified."
        : saved
          ? "Roll saved. The scene outcome is unavailable."
          : null;
  const lastEvent = bundle.events.at(-1);
  const callEnded = lastEvent?.type === AGENT_CALL_ENDED ? lastEvent.summary : null;
  const visibleEvents = shownLifeEvents(bundle.events);

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
    { label: "Cash", value: formatMoney(bundle.vitals.eurobucks) },
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
      conditions: [
        ...(state?.flags ?? []).map((flag) => flagMeaning(flag) ?? flag),
        ...(key === CLINIC_PLACE && bundle.neighborhood.lease
          ? [clinicDescription(bundle.neighborhood)]
          : []),
      ],
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

  const journal = (close: () => void) => (
    <>
      {lucyHook && <p>Adventure source · {lucyHook.mission.source}</p>}
      {life.phase === "life" && (
        <NeighborhoodCard
          journal
          state={bundle.neighborhood}
          context={neighborhoodContext(bundle)}
          location={locationKey}
          travelMode={life.vehicleRule}
          busy={life.busy || !!life.pendingCheck}
          act={life.takeNeighborhoodAction}
          travel={(to) => {
            close();
            setStatusOpen(false);
            life.travelTo(to);
          }}
        />
      )}
      {visibleEvents.length > 0 && (
        <details className="my-4">
          <summary className="cursor-pointer py-2">Earlier events</summary>
          <LifeLog
            events={bundle.events}
            here={standing}
            onBrowse={(vendor) => {
              close();
              openShop(vendor);
            }}
            climber={{
              roleId: bundle.character.character.role,
              homeDistrictKey: bundle.character.finance?.home_district_key ?? null,
            }}
          />
        </details>
      )}
    </>
  );
  const rail = (
    <div className="life-rail">
      <LifeRail
        life={life}
        bundle={bundle}
        luckLeft={luckLeft}
        luckMax={luckMax}
        status={status}
        journal={journal}
        onOpenShop={() => openShop()}
      />
    </div>
  );
  const waiting = life.busy || !!submitted;
  const suggested = life.actions.map((action) => (
    <ActionCard
      key={action.label}
      action={action}
      character={bundle.character}
      context={rollContext}
      busy={waiting}
      onPick={() => void send(cardInput(action), action)}
    />
  ));
  const sceneTitle = sceneArt(locationKey).title;
  const atHome =
    standing &&
    standing === (bundle.campaign.home_place_key ?? bundle.character.finance?.home_place_key);
  const latest = visibleEvents.at(-1);
  // A resumed offer may contain the old automatic introduction. Show replies to
  // player actions here, while keeping earlier narration available in the Journal.
  const offeredAt = lucyHook
    ? bundle.events.filter((e) => e.type === "hook_offered").at(-1)?.seq
    : undefined;
  const showPassage =
    !lucyHook ||
    !!call ||
    bundle.events.some(
      (e) =>
        e.type === "player_input" &&
        e.seq > (offeredAt ?? -1) &&
        e.seq < (life.narration?.event.seq ?? -1),
    );
  const composer = (
    <LifeComposer
      draft={draft}
      onDraft={setDraft}
      busy={waiting}
      onAct={() => void send(draft.trim())}
      onSuggest={life.askOptions}
      onHangUp={call ? (keyboard) => void hangUp(keyboard) : undefined}
      suggestions={
        life.actions.length > 0 && (
          <div className="life-suggestions" aria-label="Suggested actions">
            {suggested.slice(0, 2)}
            {suggested.length > 2 && (
              <details className="life-more-actions">
                <summary>More actions ({suggested.length - 2})</summary>
                {suggested.slice(2)}
              </details>
            )}
          </div>
        )
      }
    />
  );
  return (
    <TooltipProvider delayDuration={150}>
      <div className="life-play">
        <div className="life-shell">
          <header className="life-mast">
            <div className="life-brand">
              Night City Tales <b aria-hidden="true">//</b>
            </div>
            <span className="life-campaign">{bundle.campaign.name}</span>
            <div className="life-utilities">
              <MapButton
                compact
                locationKey={bundle.campaign.location_key ?? DEFAULT_START}
                knownPlaces={knownPlaces}
                onTravel={life.travelTo}
                travelBusy={life.busy || !!life.pendingCheck}
                {...(life.vehicleRule ? { travelMode: life.vehicleRule } : {})}
                signals={signals}
                placeHere={placeHere}
                clinicOpen={!!bundle.neighborhood.lease}
              />
              <NCAmp compact />
            </div>
          </header>
          <MobileStatusBar
            title={bundle.character.character.name}
            chips={chips}
            open={statusOpen}
            onOpenChange={setStatusOpen}
            showRadio={false}
          >
            {rail}
          </MobileStatusBar>
          <div className={lucyHook ? "life-layout lucy-layout" : "life-layout"}>
            <div className="life-main" ref={shopHeading} tabIndex={-1}>
              {shopOpen ? (
                // The Counter, in place of the scene. The input is hidden: a
                // shop is for shopping, and "Talk to them" goes back to the scene.
                <ShopView
                  key={shopVendor ?? "shop"}
                  bundle={bundle}
                  vendorId={shopVendor}
                  talk={{
                    onSay: async (text) => (await life.act(text)) !== false,
                    busy: life.busy,
                    last: life.narration?.text ?? null,
                    waitingOnRoll: !!life.pendingCheck,
                    onScene: () => setShopOpen(false),
                  }}
                  onClose={() => setShopOpen(false)}
                  onTravel={life.travelTo}
                  travelBusy={life.travelBusy}
                  travelMode={life.vehicleRule}
                  onTalk={() => setShopOpen(false)}
                />
              ) : (
                <>
                  {/* What happened on the job they just finished: the peak, and what it left open. */}
                  {previously && bundle.lastFrame && (
                    <PreviouslyCard
                      frame={previously}
                      onDismiss={() => {
                        writeDismissed(campaignId, bundle.lastFrame!.settledId);
                        setDismissedFrame(bundle.lastFrame!.settledId);
                      }}
                    />
                  )}

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

                  <LifeSceneContent
                    lead={
                      lucyHook ? (
                        <LucyOffer
                          hook={lucyHook}
                          location={sceneTitle + " · " + formatLifeClock(bundle.clock)}
                          busy={waiting || !!life.pendingCheck}
                          onAccept={life.acceptHook}
                          onPass={life.declineHook}
                          onAsk={life.pushHook}
                        />
                      ) : (
                        <>
                          <SceneHero
                            key={locationKey}
                            locationKey={locationKey}
                            clock={bundle.clock}
                          />
                          {(faces.length > 0 ||
                            sellerHere ||
                            (atHome && bundle.character.character.role === "tech")) && (
                            <div className="life-presence">
                              <SceneFaces faces={faces} compact />
                              <div className="life-local-actions">
                                {sellerHere && (
                                  <button
                                    type="button"
                                    id="life-browse"
                                    className="life-link"
                                    onClick={() => openShop(sellerHere.id)}
                                  >
                                    Browse the counter
                                  </button>
                                )}
                                {atHome && bundle.character.character.role === "tech" && (
                                  <WorkshopSheet bundle={bundle} contextual />
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    }
                    narration={
                      <>
                        <p role="status" className={callEnded ? "life-agent-ended" : "sr-only"}>
                          {call
                            ? `${call.direction === "incoming" ? "Incoming" : "Outgoing"} voice call connected with ${call.name}.`
                            : callEnded}
                        </p>
                        {call && <AgentCallStrip player={bundle.character.character} call={call} />}
                        {showPassage && passage ? (
                          <article className="life-passage">
                            {!lucyHook &&
                              passage.title &&
                              passage.title.trim().toLowerCase() !==
                                sceneTitle.trim().toLowerCase() && <h2>{passage.title}</h2>}
                            <div>
                              <NpcText text={passage.text} />
                            </div>
                          </article>
                        ) : !lucyHook &&
                          !checkResult &&
                          !life.atNeighborhoodScene &&
                          latest &&
                          latest.type !== "neighborhood_action" ? (
                          <div className="life-passage">
                            <LifeEvent event={latest} here={standing} onBrowse={openShop} />
                          </div>
                        ) : null}
                      </>
                    }
                    outcome={
                      !outcome && !life.checkBusy ? <ReceiptBar receipts={receipts} /> : null
                    }
                    controls={sceneControls}
                  />
                  {life.phase === "life" && (
                    <NeighborhoodCard
                      state={bundle.neighborhood}
                      context={neighborhoodContext(bundle)}
                      location={locationKey}
                      receipt={lastEvent?.type === "neighborhood_action" ? lastEvent.summary : null}
                      travelMode={life.vehicleRule}
                      busy={life.busy || !!life.pendingCheck}
                      act={life.takeNeighborhoodAction}
                      travel={life.travelTo}
                    />
                  )}
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
                  {life.hook && !lucyHook && <HookCard life={life} />}
                  <div className="life-turn-area">
                    {life.actionError && (
                      <p role="alert" className="life-error">
                        {life.actionError.message}
                      </p>
                    )}
                    {waiting && !life.checkBusy && !life.endingCall && (
                      <div className="life-wait" role="status">
                        {submitted && <p>{submitted}</p>}
                        <span className="sr-only">Resolving your turn.</span>
                        <CityTurns context={turnContext} seed={bundle.events.length} />
                      </div>
                    )}
                    <p role="status" className="sr-only">
                      {activeAttempt && checkResult
                        ? `${lifeCheckAnnouncement(checkResult)} ${resultStatus ?? ""}`
                        : ""}
                    </p>
                    {checkResult && (
                      <LifeCheckResult
                        key={resultPrompt}
                        roll={checkResult}
                        skillName={saved?.skillName ?? activeAttempt?.pending.skillName ?? "Skill"}
                        summaryRef={landedSummary}
                        status={resultStatus}
                        recovery={
                          unresolved && (
                            <div className="life-check-recovery">
                              {settlement?.error && <p>{settlement.error}</p>}
                              <button
                                type="button"
                                className="life-link"
                                onClick={life.recoverCheck}
                              >
                                {settlement?.state === "unsaved"
                                  ? "Save this roll again"
                                  : "Check saved roll"}
                              </button>
                            </div>
                          )
                        }
                        outcome={
                          outcome?.summary && (
                            <div className="life-check-outcome">
                              <NpcText text={outcome.summary} />
                              <ReceiptBar receipts={receipts} />
                            </div>
                          )
                        }
                      />
                    )}
                    {canRoll && (
                      <LifeCheckCard
                        key={canRoll.eventId}
                        pending={canRoll}
                        focusHeading={!!lucyHook}
                        roll={(luckSpend) => rollCheck(canRoll, luckSpend)}
                        odds={(luckSpend) => checkOdds(canRoll, luckSpend)}
                        onLanded={(rolled, hadFocus) => {
                          restoreRollFocus.current = hadFocus;
                          life.commitCheck(canRoll, rolled);
                        }}
                        busy={waiting}
                        luckRemaining={luckLeft}
                      />
                    )}
                    {inventoryRefusals.length > 0 && (
                      <div role="status" className="space-y-1">
                        {inventoryRefusals.map((event) => (
                          <LifeEvent
                            event={event}
                            key={event.id}
                            here={standing}
                            onBrowse={openShop}
                          />
                        ))}
                      </div>
                    )}
                    {!canRoll &&
                      !life.checkBusy &&
                      !unresolved &&
                      (lucyHook && !call ? (
                        <details className="lucy-disclosure">
                          <summary>Say or do something else</summary>
                          {composer}
                        </details>
                      ) : (
                        composer
                      ))}
                  </div>
                </>
              )}
            </div>
            <aside className="life-desktop-status" aria-label="Character status">
              {lucyHook ? (
                <details className="lucy-disclosure">
                  <summary>{bundle.character.character.name} · Character status</summary>
                  {rail}
                </details>
              ) : (
                rail
              )}
            </aside>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
