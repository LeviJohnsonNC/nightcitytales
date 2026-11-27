import { useEffect, useRef, type ReactNode } from "react";
import { ArrowRight, FileText, NotebookPen, SlidersHorizontal } from "lucide-react";
import {
  agreedMissionFee,
  describePosition,
  formatDuration,
  formatLifeClock,
  getSkill,
  resolveSkillId,
  placeKeyOf,
  type BeatExit,
} from "@/engine";
import {
  NIGHT_AT_THE_OPERA,
  OPERA_OPENING_BEAT,
  operaApproaches,
  operaEntryRoute,
  operaFirstLead,
} from "@/engine/missions/nightAtTheOpera";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { GmSuggestedAction } from "@/features/gm/gmResponse";
import type { CampaignEvent } from "@/lib/backend";
import { NCAmp } from "@/features/music/ncamp/NCAmp";
import { MobileStatusBar, type StatChip } from "./mobileShell";
import type { PlayBundle } from "./playBundleOps";
import "@/features/life/life.css";
import "./opera-opening.css";

const DESK = "/images/missions/evergreen-desk";
const HANDBILL = "/images/missions/opera-handbill.webp";

function disclosedClient(events: CampaignEvent[]) {
  const start = events.map(({ type }) => type).lastIndexOf("mission_started");
  if (start < 0) return null;
  const started = events[start]?.data as { missionId?: unknown } | null;
  if (started?.missionId !== NIGHT_AT_THE_OPERA.id) return null;
  const previous = events.slice(0, start);
  const offered = previous.map(({ type }) => type).lastIndexOf("hook_offered");
  if (offered < 0) return null;
  const offer = previous[offered]?.data as { missionId?: unknown; situationKey?: unknown } | null;
  if (offer?.missionId !== started.missionId || typeof offer.situationKey !== "string") return null;
  const learned = previous.slice(offered + 1).some((event) => {
    const data = event.data as { situationKey?: unknown; ask?: unknown; success?: unknown } | null;
    return (
      event.type === "hook_negotiated" &&
      data?.situationKey === offer.situationKey &&
      data?.ask === "patron" &&
      data.success === true
    );
  });
  return learned ? NIGHT_AT_THE_OPERA.offer : null;
}

const SHOWN_ACTIONS = 4;

export function OperaOpening({
  bundle,
  onChoose,
  busy,
  blocked,
  tools,
  history,
  status,
  navigation,
  roleTools,
  roleLabel,
  currentTurn,
  prompts,
  composer,
  pendingId,
  chips,
  ideas,
  moreIdeas,
  onTry,
  onSuggest,
  suggestionStatus,
  suggesting,
}: {
  bundle: PlayBundle;
  onChoose: (exit: BeatExit, input?: string) => void;
  busy: boolean;
  blocked: boolean;
  tools: ReactNode;
  history: ReactNode;
  status: ReactNode;
  navigation: ReactNode;
  roleTools: ReactNode;
  roleLabel: string;
  currentTurn: ReactNode;
  prompts: ReactNode;
  composer: ReactNode;
  pendingId: string | undefined;
  chips: StatChip[];
  ideas: GmSuggestedAction[];
  moreIdeas: GmSuggestedAction[];
  onTry: (idea: GmSuggestedAction) => void;
  onSuggest: (labels: readonly string[]) => void;
  suggestionStatus: string;
  suggesting: boolean;
}) {
  const atDesk = placeKeyOf(bundle.campaign.location_key) === "p4";
  const beforeLead = bundle.beat?.id === OPERA_OPENING_BEAT;
  const lead = operaFirstLead(bundle.runtime);
  const route = operaEntryRoute(bundle.runtime);
  const activeRoute = route?.to === bundle.beat?.id ? route : undefined;
  const sceneHeading = useRef<HTMLHeadingElement>(null);
  const beatId = bundle.beat?.id;
  const previousBeatId = useRef(beatId);
  const pending = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pendingId) pending.current?.focus();
  }, [pendingId]);
  useEffect(() => {
    if (!pendingId && beatId !== previousBeatId.current) sceneHeading.current?.focus();
    previousBeatId.current = beatId;
  }, [beatId, pendingId]);

  const mission = NIGHT_AT_THE_OPERA;
  const gettingTickets = beatId === "getting_tickets";
  const inShow = beatId === "night_at_opera";
  const atOffice = beatId === "empty_office_hours";
  const hasHandbill = !beforeLead && !inShow && !atOffice;
  const result = gettingTickets ? route : activeRoute;
  const title = gettingTickets
    ? (route?.title ?? "Find a way into the show")
    : (activeRoute?.title ?? (atOffice ? "The professor’s office" : bundle.beat?.title));
  const client = disclosedClient(bundle.events);
  const total = agreedMissionFee(mission, bundle.agreedPayout);

  const exits = bundle.availableExits.map((exit) => {
    const approach = beforeLead && operaApproaches.find(({ to }) => to === exit.to);
    const label =
      approach && approach.to === "opera_clerk" && !atDesk ? "Call the desk clerk" : exit.label;
    return {
      label,
      detail: approach
        ? `${approach.hint} · ${formatDuration(approach.minutes)}`
        : inShow && exit.to === "noodles_and_info"
          ? "Continue after the performance"
          : "",
      run: () => onChoose(exit, label),
    };
  });
  const suggestionRow = (idea: GmSuggestedAction) => {
    const skill = idea.skill ? resolveSkillId(idea.skill) : undefined;
    return {
      label: idea.label,
      detail: skill ? getSkill(skill).name : "",
      run: () => onTry(idea),
    };
  };
  const choices = [...ideas.map(suggestionRow), ...exits, ...moreIdeas.map(suggestionRow)];
  const renderRow = ({ label, detail, run }: (typeof choices)[number]) => (
    <li key={label}>
      <button className="opera-follow" type="button" onClick={run} disabled={blocked}>
        <span>
          <strong>{label}</strong>
          {detail && <small>{detail}</small>}
        </span>
        <ArrowRight aria-hidden="true" size={16} />
      </button>
    </li>
  );

  const rail = (
    <div className="opera-case">
      {status}
      <nav className="life-rail-nav opera-navigation" aria-label="Campaign">
        {navigation}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost">
              <FileText aria-hidden="true" />
              Case file
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="overflow-y-auto" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>Case file</SheetTitle>
            </SheetHeader>
            <div className="opera-reference">
              <h3>Find Lucy Rhinemeyer</h3>
              <p>Last seen near the University District.</p>
              <p>
                {client
                  ? `${client.patronName} · ${client.patronOrg}`
                  : "Rhinemeyer family representative"}
              </p>
              <p>
                <strong>{total.toLocaleString("en-CA")} eb</strong> agreed for recovery
              </p>
              {lead && <p>{lead.response}</p>}
              {route && <p>{route.response}</p>}
            </div>
          </SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost">
              <NotebookPen aria-hidden="true" />
              Journal
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="overflow-y-auto" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>Journal</SheetTitle>
            </SheetHeader>
            <div className="opera-reference">
              {history}
              <p>Adventure source · {mission.source}</p>
            </div>
          </SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost">
              <SlidersHorizontal aria-hidden="true" />
              {roleLabel}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="overflow-y-auto" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>{roleLabel}</SheetTitle>
            </SheetHeader>
            <div className="opera-reference">{roleTools}</div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );

  return (
    <div className="life-play opera-play">
      <div className="life-shell opera-shell">
        <header className="life-mast opera-mast">
          <span className="life-brand">
            Night City Tales <b aria-hidden="true">//</b>
          </span>
          <span className="opera-campaign">{bundle.campaign.name}</span>
          <div className="opera-tools">
            {tools}
            <NCAmp compact />
          </div>
        </header>
        <MobileStatusBar title={bundle.character.character.name} chips={chips} showRadio={false}>
          {rail}
        </MobileStatusBar>
        <div className="opera-layout">
          <main className="opera-main">
            <header className="opera-heading">
              <p className="opera-eyebrow">
                {describePosition(bundle.campaign.location_key)} ·{" "}
                {formatLifeClock(bundle.campaign)}
              </p>
              <h1 ref={beforeLead ? sceneHeading : undefined} tabIndex={-1}>
                Find Lucy Rhinemeyer
              </h1>
            </header>
            {beforeLead && (
              <>
                <figure className="opera-art">
                  <img
                    src={DESK + "-1440.webp"}
                    srcSet={DESK + "-720.webp 720w, " + DESK + "-1440.webp 1440w"}
                    sizes="(min-width: 1300px) 870px, (min-width: 900px) 70vw, 100vw"
                    width={1440}
                    height={480}
                    fetchPriority="high"
                    alt="An Evergreen Apartments clerk watches Lucy Rhinemeyer’s missing-person report."
                  />
                  <figcaption>
                    {atDesk
                      ? "Evergreen Apartments · Front desk"
                      : "Evergreen Apartments · Net 54 relay"}
                  </figcaption>
                </figure>
                <p className="opera-passage">
                  A handbill flashes past in the Net 54 footage. In one corner you catch the
                  Philharmonic Vampyres’ crest.{" "}
                  {atDesk
                    ? "The front desk has the same report on its monitor."
                    : "The report is still on your Agent. The Evergreen front desk and the campus paper both take tips."}
                </p>
              </>
            )}
            {!beforeLead && (
              <section
                className={hasHandbill ? "opera-investigation" : "opera-result"}
                aria-labelledby="opera-lead"
              >
                {hasHandbill && (
                  <figure className="opera-handbill">
                    <img
                      src={HANDBILL}
                      width={900}
                      height={600}
                      alt="A worn black concert handbill with a silver engraving"
                    />
                    <figcaption>Philharmonic Vampyres · Old Symphony Hall</figcaption>
                  </figure>
                )}
                <div className="opera-lead">
                  <h2 id="opera-lead" ref={sceneHeading} tabIndex={-1}>
                    {title}
                  </h2>
                  {result && <p className="opera-passage">{result.response}</p>}
                  {!result && hasHandbill && !gettingTickets && lead && (
                    <p className="opera-passage">{lead.response}</p>
                  )}
                  {gettingTickets && (
                    <p className="opera-passage">
                      {!route &&
                        "Garden Patch lists tickets for tomorrow night at the old Symphony Hall. "}
                      A student says their psychology advisor has stopped answering messages.
                    </p>
                  )}
                  {(inShow || atOffice) && !currentTurn && bundle.beat?.playerBrief && (
                    <p className="opera-passage">{bundle.beat.playerBrief}</p>
                  )}
                </div>
              </section>
            )}
            {currentTurn}
            <div ref={pending} tabIndex={-1} aria-label="Action feedback">
              {prompts}
            </div>
            <section aria-label="Scene actions" className="opera-actions">
              {composer}
              <p role="status" className="opera-wait">
                {busy
                  ? "Resolving your action…"
                  : pendingId
                    ? "Resolve the roll to act again."
                    : ""}
              </p>
              <div className="opera-action-heading">
                {choices.length > 0 && <h2>Actions you can try</h2>}
                <button
                  type="button"
                  className="life-link"
                  aria-disabled={suggesting || blocked}
                  onClick={() => {
                    if (!suggesting && !blocked) onSuggest(choices.map(({ label }) => label));
                  }}
                >
                  {choices.length > 0 ? "Suggest more actions" : "Suggest actions"}
                </button>
              </div>
              <p className="opera-wait" role="status">
                {suggestionStatus}
              </p>
              <ul className="opera-next">{choices.slice(0, SHOWN_ACTIONS).map(renderRow)}</ul>
              {choices.length > SHOWN_ACTIONS && (
                <details className="opera-ideas">
                  <summary>More ideas ({choices.length - SHOWN_ACTIONS})</summary>
                  <ul className="opera-next">{choices.slice(SHOWN_ACTIONS).map(renderRow)}</ul>
                </details>
              )}
            </section>
          </main>
          <aside className="opera-rail" aria-label="Character and case">
            {rail}
          </aside>
        </div>
      </div>
    </div>
  );
}
