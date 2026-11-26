import { useEffect, useRef, type ReactNode } from "react";
import { ArrowRight, AudioLines, MessageSquareText, PhoneCall } from "lucide-react";
import {
  agreedMissionFee,
  describePosition,
  formatDuration,
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
import { NCAmp } from "@/features/music/ncamp/NCAmp";
import type { PlayBundle } from "./playBundleOps";
import "@/features/life/life.css";
import "./opera-opening.css";

const DESK = "/images/missions/evergreen-desk";
const approachIcons = [MessageSquareText, AudioLines, PhoneCall];

export function OperaOpening({
  bundle,
  onChoose,
  busy,
  blocked,
  tools,
  history,
  status,
  currentTurn,
  prompts,
  composer,
}: {
  bundle: PlayBundle;
  onChoose: (exit: BeatExit, input?: string) => void;
  busy: boolean;
  blocked: boolean;
  tools: ReactNode;
  history: ReactNode;
  status: ReactNode;
  currentTurn: ReactNode;
  prompts: ReactNode;
  composer: ReactNode;
}) {
  const atDesk = placeKeyOf(bundle.campaign.location_key) === "p4";
  const beforeLead = bundle.beat?.id === OPERA_OPENING_BEAT;
  const lead = operaFirstLead(bundle.runtime);
  const route = operaEntryRoute(bundle.runtime);
  const activeRoute = route?.to === bundle.beat?.id ? route : undefined;
  const leadHeading = useRef<HTMLHeadingElement>(null);
  const beatId = bundle.beat?.id;
  const previousBeatId = useRef(beatId);
  useEffect(() => {
    if (beatId !== previousBeatId.current) leadHeading.current?.focus();
    previousBeatId.current = beatId;
  }, [beatId]);

  const mission = NIGHT_AT_THE_OPERA;
  const objective = bundle.runtime?.objectives.find((item) => item.status === "active");
  const total = agreedMissionFee(mission, bundle.agreedPayout);

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
        <div className="opera-layout">
          <main className="opera-main">
            <header className="opera-heading">
              <p className="opera-eyebrow">
                Job accepted · {describePosition(bundle.campaign.location_key)}
              </p>
              <h1>Find Lucy Rhinemeyer</h1>
            </header>
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
            {beforeLead ? (
              <p className="opera-passage">
                A handbill flashes past in the Net 54 footage. In one corner you catch the
                Philharmonic Vampyres’ crest.{" "}
                {atDesk
                  ? "The front desk has the same report on its monitor."
                  : "The report is still on your Agent. The Evergreen front desk and the campus paper both take tips."}
              </p>
            ) : lead ? (
              <section className="opera-result" aria-labelledby="opera-lead">
                <h2 id="opera-lead" ref={leadHeading} tabIndex={-1} className="opera-eyebrow">
                  {activeRoute ? "Way in confirmed" : "Lead found"}
                </h2>
                <p className="opera-passage">{activeRoute?.response ?? lead.response}</p>
              </section>
            ) : null}
            {currentTurn}
            {prompts}
            <section aria-label="Scene actions" className="opera-actions">
              {beforeLead ? (
                <div className="opera-approaches">
                  {operaApproaches.map((approach, index) => {
                    const exit = bundle.availableExits.find(({ to }) => to === approach.to);
                    if (!exit) return null;
                    const Icon = approachIcons[index]!;
                    const label =
                      approach.to === "opera_clerk" && !atDesk ? "Call the desk clerk" : exit.label;
                    return (
                      <button
                        key={exit.to}
                        className="opera-approach"
                        type="button"
                        onClick={() => onChoose(exit, label)}
                        disabled={blocked}
                      >
                        <Icon aria-hidden="true" size={18} />
                        <span>
                          <strong>{label}</strong>
                          <small>
                            {approach.hint} · {formatDuration(approach.minutes)}
                          </small>
                        </span>
                        <ArrowRight aria-hidden="true" size={15} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {bundle.availableExits.map((exit) => (
                    <button
                      key={exit.to}
                      className="opera-follow"
                      type="button"
                      onClick={() => onChoose(exit)}
                      disabled={blocked}
                    >
                      {exit.label} <ArrowRight aria-hidden="true" size={16} />
                    </button>
                  ))}
                </div>
              )}
              {composer}
              <p role="status" className="opera-wait">
                {busy ? "Resolving your action…" : ""}
              </p>
            </section>
          </main>
          <aside className="opera-case" aria-labelledby="opera-case-title">
            <section className="opera-case-file">
              <h2 id="opera-case-title" className="opera-eyebrow">
                Case file
              </h2>
              {objective && <p className="opera-objective">{objective.text}</p>}
              <p className="opera-case-detail">Last seen near the University District</p>
              {lead && (
                <div className="opera-evidence">
                  <p className="opera-eyebrow">Current lead</p>
                  <p>{lead.lead}</p>
                </div>
              )}
              {route && (
                <div className="opera-evidence">
                  <p className="opera-eyebrow">Way in</p>
                  <p>{route.title}</p>
                </div>
              )}
            </section>
            <details className="opera-disclosure">
              <summary>Job brief</summary>
              <div className="opera-disclosure-body">
                <p>{mission.patron}</p>
                <p>{total.toLocaleString("en-CA")} eb agreed for recovery</p>
                <p>{mission.beats.find(({ id }) => id === OPERA_OPENING_BEAT)?.playerBrief}</p>
              </div>
            </details>
            <details className="opera-disclosure">
              <summary>History</summary>
              <div className="opera-disclosure-body opera-history">
                {history}
                <p>Adventure source · {mission.source}</p>
              </div>
            </details>
            <details className="opera-disclosure">
              <summary>Character status</summary>
              <div className="opera-disclosure-body">{status}</div>
            </details>
          </aside>
        </div>
      </div>
    </div>
  );
}
