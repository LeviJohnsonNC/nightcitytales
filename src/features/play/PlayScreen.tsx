/**
 * The play screen: the narrative log and input in the center, with the
 * always-visible constructs (character vitals, the current scene + objectives +
 * choices, and the battlefield) alongside — all reading live campaign state.
 */
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CampaignEvent } from "@/lib/backend";
import { getSkill, resolveSkillId, IP_PLAYSTYLES, type IpPlaystyle } from "@/engine";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { GmSuggestedAction } from "@/features/gm/gmResponse";
import { CheckCard } from "./CheckCard";
import { CombatBoard } from "./CombatBoard";
import { CombatCard } from "./CombatCard";
import { DeathSaveCard } from "./DeathSaveCard";

import { JobCard } from "./JobCard";
import { SheetDrawer } from "./SheetDrawer";
import { BottomDock, MobileStatusBar } from "./mobileShell";
import { DowntimePanel } from "@/features/downtime/DowntimePanel";
import { RoleAbilityPanel } from "./RoleAbilityPanel";
import { gmSkillList, suggestionInput } from "./playModel";
import { settlementFrom, wasShorted } from "./settlementReport";
import { NpcText } from "@/features/cast/NpcText";
import { usePlay, type PlayBundle } from "./usePlay";
import type { RollRecord } from "./checkPrompt";

function EventBlock({ event }: { event: CampaignEvent }) {
  const text = event.summary ?? "";
  switch (event.type) {
    case "player_input":
      return (
        <p className="border-l-2 border-accent/60 pl-3 text-sm italic text-accent">&gt; {text}</p>
      );
    case "gm_narration":
      return (
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground sm:text-sm sm:leading-relaxed">
          <NpcText text={text} />
        </p>
      );

    case "skill_check":
    case "attack":
    case "death_save":
      return (
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-accent">◆</span> {text}
        </p>
      );
    case "oracle_roll":
      // An oracle the player is allowed to watch: the die that decided the
      // shape of the job, shown once the job is over.
      return (
        <p className="font-mono text-xs text-muted-foreground/80">
          <span className="text-muted-foreground">⚄</span> {text}
        </p>
      );
    // A secret roll is written to the ledger the moment it happens and shown to
    // nobody. This case exists because the default branch below renders any
    // unrecognised event, which would make a new secret type leak by omission.
    case "oracle_secret":
    case "check_prompt":
      return null;
    case "beat_advanced":
      return (
        <p className="my-1 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          — {text} —
        </p>
      );
    default:
      return <p className="font-mono text-xs text-muted-foreground">{text}</p>;
  }
}

function NarrativeLog({
  events,
  readAloud,
  busy,
}: {
  events: CampaignEvent[];
  readAloud?: string | undefined;
  busy: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);
  // One scroller on a phone (the page); the desktop column keeps its own.
  return (
    <div className="space-y-3 border border-border bg-card/40 p-4 lg:flex-1 lg:overflow-y-auto">
      {readAloud && (
        <blockquote className="border-l-2 border-accent bg-accent/5 p-3 text-sm leading-relaxed text-foreground">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            Briefing
          </p>
          {readAloud}
        </blockquote>
      )}
      {events.length === 0 && !readAloud ? (
        <p className="text-sm text-muted-foreground">Night City holds its breath…</p>
      ) : (
        events.map((e) => <EventBlock key={e.id} event={e} />)
      )}
      {busy && <p className="text-sm italic text-muted-foreground">The GM is thinking…</p>}
      <div ref={endRef} />
    </div>
  );
}

type SkillHint = { name: string; base: number | null };

/** Pretty skill name + how strong the character is in it, for the hover. */
function skillHint(full: PlayBundle["character"], raw: string): SkillHint | null {
  const id = resolveSkillId(raw);
  if (!id) return null;
  const entry = gmSkillList(full).find((s) => s.id === id);
  return { name: getSkill(id).name, base: entry ? entry.base : null };
}

function SuggestionBar({
  suggestions,
  onPick,
  busy,
  character,
}: {
  suggestions: GmSuggestedAction[];
  onPick: (suggestion: GmSuggestedAction) => void;
  busy: boolean;
  character: PlayBundle["character"];
}) {
  if (suggestions.length === 0) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        {suggestions.map((s) => {
          const hint = s.skill ? skillHint(character, s.skill) : null;
          const isSkill = hint !== null;
          const button = (
            <Button
              variant="outline"
              disabled={busy}
              className={`h-auto w-full flex-col items-start gap-1 whitespace-normal py-2 text-left sm:w-auto ${
                isSkill
                  ? "border-neon-pink shadow-[0_0_8px_rgba(255,61,154,0.25)] hover:border-neon-pink/80"
                  : ""
              }`}
              onClick={() => onPick(s)}
            >
              <span className="text-sm font-semibold">{s.label}</span>
              {/* Touch has no hover: the skill hint is written out on small screens. */}
              {hint && (
                <span className="num font-mono text-[10px] uppercase tracking-[0.18em] text-neon-pink lg:hidden">
                  {hint.name}: {hint.base ?? 0}
                </span>
              )}
            </Button>
          );
          if (!isSkill) return <span key={s.label}>{button}</span>;
          return (
            <Tooltip key={s.label}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-xs border border-neon-pink bg-card text-foreground"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Skill
                </p>
                <p className="text-sm font-semibold">
                  {hint.name}: {hint.base ?? 0}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

function CharacterPanel({
  bundle,
  luck,
}: {
  bundle: PlayBundle;
  luck: { remaining: number; max: number };
}) {
  const { character, vitals } = bundle;
  return (
    <section className="space-y-3 border border-border bg-card p-4">
      <div>
        <h2 className="text-lg font-bold leading-tight">{character.character.name}</h2>
        <p className="text-sm text-muted-foreground">
          {character.character.handle ? `"${character.character.handle}" · ` : ""}
          {character.character.role}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <Label>HP</Label>
          <p className="num text-lg font-bold">
            {vitals.hp_current}/{vitals.hp_max}
          </p>
        </div>
        <div>
          <Label>Wound</Label>
          <p className="text-sm font-semibold capitalize">{vitals.wound_state}</p>
        </div>
        <div>
          <Label>Humanity</Label>
          <p className="num text-lg font-bold">
            {vitals.humanity_current}/{vitals.humanity_max}
          </p>
        </div>
      </div>
      {luck.max > 0 && (
        <div>
          <Label>Luck</Label>
          <div className="flex items-center gap-2">
            <p className="num text-lg font-bold">
              {luck.remaining}/{luck.max}
            </p>
            <div className="flex flex-wrap gap-1" aria-hidden>
              {Array.from({ length: luck.max }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i < luck.remaining ? "bg-accent" : "bg-border"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Refills with each new job</p>
        </div>
      )}
      <div>
        <Label>Eurobucks</Label>
        <p className="num text-base font-bold">{vitals.eurobucks}eb</p>
      </div>
    </section>
  );
}

/**
 * What is closing in, during the job it might close in on. Only clocks with
 * something on them: an empty dial is not pressure, it is furniture.
 */
function PressurePanel({ pressure }: { pressure: PlayBundle["pressure"] }) {
  const live = pressure.filter((p) => !p.clock.hidden && p.clock.filled > 0);
  if (live.length === 0) return null;
  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Pressure
      </p>
      {live.map(({ clock }) => (
        <div key={clock.key}>
          <p className="flex justify-between text-sm">
            <span>{clock.label}</span>
            <span className="num font-mono text-xs text-muted-foreground">
              {clock.filled}/{clock.segments}
            </span>
          </p>
          <div className="mt-1 flex gap-1" aria-hidden>
            {Array.from({ length: clock.segments }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 ${i < clock.filled ? "bg-destructive" : "bg-border"}`}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function ScenePanel({
  bundle,
  onChoose,
  busy,
}: {
  bundle: PlayBundle;
  onChoose: (to: PlayBundle["availableExits"][number]) => void;
  busy: boolean;
}) {
  if (!bundle.mission || !bundle.beat) {
    return (
      <section className="border border-border bg-card p-4">
        <Label>Scene</Label>
        <p className="mt-1 text-sm text-muted-foreground">No active mission.</p>
      </section>
    );
  }
  const activeObjectives = bundle.runtime?.objectives.filter((o) => o.status === "active") ?? [];
  return (
    <section className="space-y-3 border border-border bg-card p-4">
      <div>
        <Label>{bundle.mission.title}</Label>
        <h3 className="text-base font-bold">{bundle.beat.title}</h3>
      </div>
      {activeObjectives.length > 0 && (
        <div>
          <Label>Objectives</Label>
          <ul className="mt-1 space-y-1 text-sm">
            {activeObjectives.map((o) => (
              <li key={o.id} className="text-muted-foreground">
                • {o.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {bundle.availableExits.length > 0 && (
        <div className="space-y-2">
          <Label>Move the story on</Label>
          {bundle.availableExits.map((exit) => (
            <Button
              key={exit.to}
              variant="outline"
              size="sm"
              className="w-full justify-start whitespace-normal text-left"
              disabled={busy}
              onClick={() => onChoose(exit)}
            >
              {exit.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}

function RollHistory({ rolls }: { rolls: RollRecord[] }) {
  if (rolls.length === 0) return null;
  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <Label>Rolls · {rolls.length}</Label>
      <ul className="space-y-1">
        {rolls.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">
              {r.skillName}
              {r.opposedBy ? (
                <span className="text-muted-foreground"> vs {r.opposedBy}</span>
              ) : null}
            </span>
            <span className="num font-mono text-xs text-muted-foreground">
              {r.total}
              {r.dv !== null ? ` vs ${r.dv}` : ""}{" "}
              <span
                className={
                  r.critical ? "text-neon-pink" : r.success ? "text-accent" : "text-destructive"
                }
              >
                {r.success === null ? "—" : r.success ? "HIT" : "MISS"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What the job cost, itemised.
 *
 * Shown because a number that silently changed teaches nothing: seeing which
 * observations the engine read off the ledger is what makes the pressure feel
 * earned rather than arbitrary.
 */
function SettlementReport({ events }: { events: CampaignEvent[] }) {
  const view = settlementFrom(events);
  if (!view) return null;

  return (
    <section className="space-y-2 border border-border bg-card/50 p-3">
      <Label>What the job cost</Label>

      {view.payment && (
        <p className={`num text-sm ${wasShorted(view) ? "text-destructive" : ""}`}>
          {view.payment.paid}eb paid
          {wasShorted(view) && (
            <span className="text-muted-foreground"> of {view.payment.agreed}eb agreed</span>
          )}
        </p>
      )}

      {(view.mechanical.hp ||
        view.mechanical.armor.length > 0 ||
        view.mechanical.ammunition.length > 0 ||
        view.mechanical.criticalInjuries > 0) && (
        <div className="space-y-1 text-sm text-muted-foreground">
          {view.mechanical.hp && (
            <p>
              HP {view.mechanical.hp.before} → {view.mechanical.hp.after}
              {view.mechanical.hp.lost > 0 ? ` (−${view.mechanical.hp.lost})` : ""}
            </p>
          )}
          {view.mechanical.armor.map((armor) => (
            <p key={armor.location}>
              {armor.location === "head" ? "Head" : "Body"} armor {armor.before} → {armor.after}
            </p>
          ))}
          {view.mechanical.ammunition.map((ammo) => (
            <p key={ammo.inventoryId}>
              {ammo.weapon}: {ammo.spent} rounds spent, {ammo.after} loaded
            </p>
          ))}
          {view.mechanical.criticalInjuries > 0 && (
            <p>{view.mechanical.criticalInjuries} critical injuries suffered</p>
          )}
        </div>
      )}

      {view.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing the city noticed.</p>
      ) : (
        <ul className="space-y-1">
          {view.lines.map((line) => (
            <li key={line.observation} className="text-sm">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                {line.count > 1 ? `${line.count}× ` : ""}
                {line.observation}
              </span>{" "}
              <span className="text-muted-foreground">— {line.because || line.meaning}</span>
            </li>
          ))}
        </ul>
      )}

      {view.survivors.length > 0 && (
        <p className="text-sm">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-destructive">
            Walked away
          </span>{" "}
          <span className="text-muted-foreground">
            {view.survivors.join(", ")} — and remembers you.
          </span>
        </p>
      )}

      {view.pressure.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {view.pressure.map((change) => (
            <li key={`${change.kind}-${change.key}`}>
              {change.label}: {change.before} → {change.after}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IpPanel({ play }: { play: ReturnType<typeof usePlay> }) {
  const [primary, setPrimary] = useState<IpPlaystyle>("warrior");
  const [secondary, setSecondary] = useState<IpPlaystyle>("roleplayer");
  const tally = play.ipTally;

  if (play.ipAwarded !== null && !tally) {
    return (
      <p className="num text-sm">
        Improvement Points: <span className="font-bold">{play.ipAwarded} IP</span> (already awarded)
      </p>
    );
  }

  if (tally) {
    return (
      <div className="space-y-1 border border-accent/50 bg-accent/5 p-3 text-sm">
        <p className="num">
          Improvement Points: <span className="font-bold">{tally.award.ip} IP</span>{" "}
          <span className="text-muted-foreground">
            ({tally.award.source} column{tally.award.fromStandout ? ", standout" : ""})
          </span>
        </p>
        <p className="text-muted-foreground">{tally.award.descriptor}</p>
        <p className="italic">{tally.judgement.reason}</p>
        {tally.award.fromStandout && tally.judgement.standout && (
          <p className="text-muted-foreground">Standout: {tally.judgement.standout.reason}</p>
        )}
        <p className="num text-muted-foreground">Career total: {tally.total} IP</p>
      </div>
    );
  }

  const Picker = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: IpPlaystyle;
    onChange: (v: IpPlaystyle) => void;
  }) => (
    <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
      {label}
      <select
        className="border border-border bg-background px-2 py-1 text-sm text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value as IpPlaystyle)}
      >
        {IP_PLAYSTYLES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-2 border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Improvement Points — declare how you played
      </p>
      <div className="flex flex-wrap gap-3">
        <Picker label="Primary" value={primary} onChange={setPrimary} />
        <Picker label="Secondary" value={secondary} onChange={setSecondary} />
        <Button
          size="sm"
          disabled={play.ipBusy}
          onClick={() => play.tallyIp({ primary, secondary })}
        >
          {play.ipBusy ? "Tallying…" : "Tally IP"}
        </Button>
      </div>
      {play.ipError && <p className="text-sm text-destructive">{play.ipError.message}</p>}
    </div>
  );
}

function WrapUpCard({
  bundle,
  status,
  play,
}: {
  bundle: PlayBundle;
  status: string;
  play: ReturnType<typeof usePlay>;
}) {
  const died = status === "died";
  const summary = [...bundle.events]
    .reverse()
    .find((e) => e.type === "mission_completed" || e.type === "campaign_ended");
  const objectives = bundle.runtime?.objectives ?? [];
  return (
    <section
      className={`space-y-3 border p-4 ${died ? "border-destructive bg-destructive/10" : "border-accent bg-accent/5"}`}
    >
      <Label>{died ? "You died in Night City" : "Job complete"}</Label>
      {summary && <p className="text-sm">{summary.summary}</p>}
      {objectives.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {objectives.map((o) => (
            <li key={o.id}>
              {o.status === "done" ? "✓" : o.status === "failed" ? "✕" : "•"} {o.text}
            </li>
          ))}
        </ul>
      )}
      <p className="num text-sm">
        Eurobucks: <span className="font-bold">{bundle.vitals.eurobucks}eb</span> · HP{" "}
        {bundle.vitals.hp_current}/{bundle.vitals.hp_max}
      </p>
      <SettlementReport events={bundle.events} />
      <IpPanel play={play} />
      {died ? (
        <Button asChild variant="outline" size="sm">
          <Link to="/roster">Back to the roster</Link>
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            The run continues — your eurobucks, wounds and gear carry over. Take the downtime here
            if you want it, then go back to the street. The next job has to find you.
          </p>
          <DowntimePanel campaignId={bundle.campaign.id} character={bundle.character} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => play.backToLife()}
              disabled={play.backToLifeBusy || play.ipAwarded === null}
              title={
                play.ipAwarded === null
                  ? "Tally this session's Improvement Points first"
                  : "Return to life between jobs"
              }
            >
              {play.backToLifeBusy ? "Heading out…" : "Back to the street"}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/roster">Back to the roster</Link>
            </Button>
          </div>
          {play.backToLifeError && (
            <p className="text-sm text-destructive">{play.backToLifeError.message}</p>
          )}
        </div>
      )}
    </section>
  );
}

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
    // Sent as typed. When to reach for the dice is the GM prompt's job, not a
    // note stapled to the player's own words and then shown back to them.
    const result = await onSend(trimmed);
    // Keep the intent in the box when the turn failed, so it can be retried.
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
            send();
          }
        }}
        placeholder="What do you do?"
        rows={2}
        className="flex-1 resize-none"
        disabled={busy}
      />
      <div className="flex gap-2 sm:flex-col">
        <Button className="flex-1 sm:flex-none" onClick={send} disabled={busy || !text.trim()}>
          {busy ? "…" : "Act"}
        </Button>
        <Button
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={onAskOptions}
          disabled={busy}
          title="Ask the GM what angles it can see. The scene does not move."
        >
          Options?
        </Button>
      </div>
    </div>
  );
}

export function PlayScreen({ campaignId }: { campaignId: string }) {
  const play = usePlay(campaignId);

  if (play.isPending) {
    return <p className="p-8 text-sm text-muted-foreground">Loading the campaign…</p>;
  }
  if (play.error) {
    return <p className="p-8 text-sm text-destructive">{play.error.message}</p>;
  }
  const bundle = play.bundle;
  if (!bundle) return null;

  const chips = [
    { label: "HP", value: `${bundle.vitals.hp_current}/${bundle.vitals.hp_max}` },
    { label: "Wound", value: bundle.vitals.wound_state },
    { label: "eb", value: `${bundle.vitals.eurobucks}` },
    ...(play.luck.max > 0
      ? [{ label: "Luck", value: `${play.luck.remaining}/${play.luck.max}` }]
      : []),
  ];

  const rail = (
    <>
      <CharacterPanel bundle={bundle} luck={play.luck} />
      <RoleAbilityPanel play={play} />
      <RollHistory rolls={play.rolls} />
      <CombatBoard
        live={play.encounter}
        capability={play.capability}
        onMoveTo={play.moveTo}
        onEndTurn={play.endTurn}
        // Inert while any turn is being written, not only the board's own: a
        // click resolved against a bundle the server has moved past would be
        // computed from stale positions.
        busy={play.busy || play.opening}
      />
      <PressurePanel pressure={bundle.pressure} />
      <ScenePanel bundle={bundle} onChoose={play.choose} busy={play.busy} />
      {bundle.mission && bundle.beat && <JobCard mission={bundle.mission} beat={bundle.beat} />}
    </>
  );

  return (
    <div className="touch-play">
      <MobileStatusBar title={bundle.character.character.name} chips={chips}>
        {rail}
      </MobileStatusBar>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-3 lg:min-h-[70vh]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 lg:sticky lg:top-0 lg:z-20 lg:-mx-4 lg:border-b lg:border-border lg:bg-background/95 lg:px-4 lg:py-3 lg:backdrop-blur supports-[backdrop-filter]:lg:bg-background/70">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                {bundle.campaign.name}
              </h1>
              {bundle.beat && (
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                  {bundle.mission?.title} · {bundle.beat.title}
                </p>
              )}
            </div>
            <SheetDrawer
              character={bundle.character}
              inventory={bundle.inventory}
              cyberware={bundle.cyberware}
            />
          </div>
          <NarrativeLog
            events={bundle.events}
            readAloud={bundle.beat?.readAloud}
            busy={play.busy || play.opening}
          />
          {play.actionError && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive">{play.actionError.message}</p>
              {play.canRetry && (
                <Button size="sm" variant="outline" onClick={play.retry} disabled={play.busy}>
                  Retry
                </Button>
              )}
            </div>
          )}
          {play.pendingCheck && (
            <div className="space-y-1">
              <CheckCard
                key={play.pendingCheck.eventId}
                pending={play.pendingCheck}
                roll={(luckSpend) => play.rollCheck(play.pendingCheck!, luckSpend)}
                onSettled={(rolled) => play.commitCheck(play.pendingCheck!, rolled)}
                busy={play.checkBusy}
                luckRemaining={play.luck.remaining}
              />
              {play.pendingCheckCount > 1 && (
                <p className="text-muted-foreground text-xs">
                  {play.pendingCheckCount - 1} more check
                  {play.pendingCheckCount - 1 === 1 ? "" : "s"} on the table after this one.
                </p>
              )}
            </div>
          )}
          {play.pendingAttack && (
            <CombatCard
              key={play.pendingAttack.eventId}
              pending={play.pendingAttack}
              character={bundle.character}
              roll={(option, luckSpend) => play.rollAttack(play.pendingAttack!, option, luckSpend)}
              onSettled={(option, result, luckSpent) =>
                play.commitAttack(play.pendingAttack!, option, result, luckSpent)
              }
              busy={play.combatBusy}
              capability={play.capability}
              luckRemaining={play.luck.remaining}
            />
          )}
          {play.pendingDeathSave && (
            <DeathSaveCard
              key={play.pendingDeathSave.eventId}
              pending={play.pendingDeathSave}
              roll={() => play.rollDeathSave()}
              onSettled={(result) => play.commitDeathSave(play.pendingDeathSave!, result)}
              busy={play.deathBusy}
            />
          )}
          {play.finished && <WrapUpCard bundle={bundle} status={play.finished} play={play} />}
          <SuggestionBar
            suggestions={play.finished ? [] : play.suggestions}
            onPick={(suggestion) => void play.submit(suggestionInput(suggestion))}
            busy={play.busy || play.opening}
            character={bundle.character}
          />
          <BottomDock>
            <InputBar
              onSend={play.submit}
              onAskOptions={play.askOptions}
              busy={
                play.busy ||
                play.opening ||
                Boolean(play.finished) ||
                Boolean(play.pendingCheck) ||
                Boolean(play.pendingAttack) ||
                Boolean(play.pendingDeathSave)
              }
            />
          </BottomDock>
        </div>
        <aside className="hidden space-y-4 lg:block">{rail}</aside>
      </div>
    </div>
  );
}
