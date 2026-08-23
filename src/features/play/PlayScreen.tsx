/**
 * The play screen: the narrative log and input in the center, with the
 * always-visible constructs (character vitals, the current scene + objectives +
 * choices, and a combat HUD) alongside — all reading live campaign state.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getActiveEncounter, getEncounter, type CampaignEvent } from "@/lib/backend";
import { usePlay, type PlayBundle } from "./usePlay";

function EventBlock({ event }: { event: CampaignEvent }) {
  const text = event.summary ?? "";
  switch (event.type) {
    case "player_input":
      return (
        <p className="border-l-2 border-accent/60 pl-3 text-sm italic text-accent">&gt; {text}</p>
      );
    case "gm_narration":
      return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text}</p>;
    case "skill_check":
    case "attack":
    case "death_save":
      return (
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-accent">◆</span> {text}
        </p>
      );
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

function NarrativeLog({ events }: { events: CampaignEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);
  return (
    <div className="flex-1 space-y-3 overflow-y-auto border border-border bg-card/40 p-4">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Night City holds its breath…</p>
      ) : (
        events.map((e) => <EventBlock key={e.id} event={e} />)
      )}
      <div ref={endRef} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

function CharacterPanel({ bundle }: { bundle: PlayBundle }) {
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
      <div>
        <Label>Eurobucks</Label>
        <p className="num text-base font-bold">{vitals.eurobucks}eb</p>
      </div>
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
          <Label>Where to</Label>
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

function CombatHud({ campaignId }: { campaignId: string }) {
  const { data } = useQuery({
    queryKey: ["play-encounter", campaignId],
    queryFn: async () => {
      const active = await getActiveEncounter(campaignId);
      return active ? getEncounter(active.id) : null;
    },
  });
  if (!data) return null;
  return (
    <section className="space-y-2 border border-destructive/50 bg-destructive/5 p-4">
      <Label>Combat — round {data.encounter.round}</Label>
      <ul className="space-y-1 text-sm">
        {data.combatants.map((c) => (
          <li key={c.id} className="flex justify-between gap-2">
            <span className={c.defeated ? "text-muted-foreground line-through" : ""}>
              {c.name} <span className="text-[10px] uppercase text-muted-foreground">{c.side}</span>
            </span>
            <span className="num font-mono text-xs">
              {c.hp_current}/{c.hp_max} · {c.wound_state}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InputBar({ onSend, busy }: { onSend: (text: string) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
  };
  return (
    <div className="flex gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="What do you do? (Enter to act, Shift+Enter for a new line)"
        rows={2}
        className="flex-1 resize-none"
        disabled={busy}
      />
      <Button onClick={send} disabled={busy || !text.trim()}>
        {busy ? "…" : "Act"}
      </Button>
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

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-h-[70vh] flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{bundle.campaign.name}</h1>
          {bundle.beat && (
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
              {bundle.mission?.title} · {bundle.beat.title}
            </p>
          )}
        </div>
        <NarrativeLog events={bundle.events} />
        {play.actionError && <p className="text-sm text-destructive">{play.actionError.message}</p>}
        <InputBar onSend={play.submit} busy={play.busy} />
      </div>
      <aside className="space-y-4">
        <CharacterPanel bundle={bundle} />
        <CombatHud campaignId={campaignId} />
        <ScenePanel bundle={bundle} onChoose={play.choose} busy={play.busy} />
      </aside>
    </div>
  );
}
