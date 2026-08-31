/**
 * /combat — the battlefield harness.
 *
 * A developer tool, deliberately unlinked from the navigation. It exists
 * because reaching a fight the normal way takes a hook, an accepted job and
 * several beats of play, which is a slow way to find out whether a marker is
 * clickable.
 *
 * It contains NO combat. It picks an arena, an opposition and a starting
 * condition, seeds a real encounter through the real `beginEncounter`, and
 * sends you to `/play/:id` — where the shipping board, the shipping gate and
 * the shipping persistence own everything. See features/dev/seedEncounter.ts.
 */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ARENAS, FORCES, FORCE_SIZES, type ForceSize } from "@/engine";
import { getActiveCampaignForCharacter, getActiveEncounter, listCharacters } from "@/lib/backend";
import {
  endEncounter,
  previewForce,
  seedEncounter,
  type SeedWound,
} from "@/features/dev/seedEncounter";

export const Route = createFileRoute("/_authenticated/combat")({
  head: () => ({
    meta: [
      { title: "Battlefield harness · Night City Tales" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CombatHarness,
});

const WOUNDS: { value: SeedWound; label: string; note: string }[] = [
  { value: "none", label: "Unhurt", note: "full HP" },
  { value: "light", label: "Lightly Wounded", note: "no penalty yet" },
  { value: "serious", label: "Seriously Wounded", note: "−2 to Checks, −2 MOVE" },
  { value: "mortal", label: "Mortally Wounded", note: "Death Save owed, −4, MOVE 1" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Choice({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`border px-3 py-2 text-left text-xs transition-colors ${
        active ? "border-neon-pink text-neon-pink" : "border-border/60 hover:border-accent"
      }`}
    >
      {children}
    </button>
  );
}

function CombatHarness() {
  const navigate = useNavigate();
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [arena, setArena] = useState(ARENAS[0]!.key);
  const [forceKey, setForceKey] = useState(FORCES[0]!.key);
  const [size, setSize] = useState<ForceSize>("standard");
  const [wound, setWound] = useState<SeedWound>("none");
  const [emptyMagazines, setEmptyMagazines] = useState(false);

  const characters = useQuery({ queryKey: ["dev-characters"], queryFn: listCharacters });
  const chosen = characters.data?.find((c) => c.id === characterId) ?? null;

  // What is already running for this character, so the harness can say what it
  // is about to reuse rather than surprising anybody with it.
  const live = useQuery({
    queryKey: ["dev-live", characterId],
    enabled: Boolean(characterId),
    queryFn: async () => {
      if (!characterId) return null;
      const campaign = await getActiveCampaignForCharacter(characterId);
      if (!campaign) return null;
      const encounter = await getActiveEncounter(campaign.id);
      return { campaign, encounter };
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!chosen) throw new Error("Pick a character first.");
      return seedEncounter({
        characterId: chosen.id,
        characterName: chosen.name,
        characterHandle: chosen.handle,
        arena,
        force: { key: forceKey, size },
        wound,
        emptyMagazines,
      });
    },
    onSuccess: (result) => {
      void navigate({ to: "/play/$id", params: { id: result.campaignId } });
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      const id = live.data?.encounter?.id;
      if (!id) return;
      await endEncounter(id);
    },
    onSuccess: () => void live.refetch(),
  });

  const preview = previewForce(forceKey, size);
  const arenaDef = ARENAS.find((a) => a.key === arena) ?? ARENAS[0]!;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-pink">
          Developer tool
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Battlefield harness</h1>
        <p className="text-sm text-muted-foreground">
          Drops a character straight into a fight so the board can be exercised without playing to
          one. It seeds a real encounter and hands you to the normal play screen — everything after
          that is the shipping code.
        </p>
        <p className="text-sm text-destructive">
          This writes to real campaign data: it moves the campaign into its Job phase, starts an
          encounter, and can change HP and ammunition. Use a character you do not mind spending.
        </p>
      </header>

      <Field label="Character">
        {characters.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {characters.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No saved characters.{" "}
            <Link to="/create" className="text-accent underline">
              Make one
            </Link>{" "}
            first.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {(characters.data ?? []).map((c) => (
            <Choice key={c.id} active={c.id === characterId} onClick={() => setCharacterId(c.id)}>
              <span className="block font-semibold">{c.handle?.trim() || c.name}</span>
              <span className="block font-mono text-[10px] text-muted-foreground">{c.role}</span>
            </Choice>
          ))}
        </div>
      </Field>

      {live.data?.campaign && (
        <div className="space-y-2 border border-accent/50 bg-accent/5 p-3">
          <p className="text-sm">
            Reusing the live campaign <strong>{live.data.campaign.name}</strong> — a character can
            only have one at a time.
          </p>
          {live.data.encounter ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                A fight is already running on it. Seeding will close that one first.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => clear.mutate()}
                disabled={clear.isPending}
              >
                End current encounter
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No fight running on it right now.</p>
          )}
        </div>
      )}

      <Field label={`Arena — ${arenaDef.extent.width} × ${arenaDef.extent.height} m`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ARENAS.map((a) => (
            <Choice
              key={a.key}
              active={a.key === arena}
              onClick={() => setArena(a.key)}
              title={`${a.extent.width} × ${a.extent.height} m, ${(a.cover ?? []).length} pieces of cover`}
            >
              <span className="block font-semibold">{a.label}</span>
              <span className="block font-mono text-[10px] text-muted-foreground">
                {a.extent.width}×{a.extent.height} m · {(a.cover ?? []).length} cover
              </span>
            </Choice>
          ))}
        </div>
      </Field>

      <Field label="Opposition">
        <div className="grid gap-2 sm:grid-cols-3">
          {FORCES.map((f) => (
            <Choice key={f.key} active={f.key === forceKey} onClick={() => setForceKey(f.key)}>
              {f.label}
            </Choice>
          ))}
        </div>
        <div className="flex gap-2">
          {FORCE_SIZES.map((s) => (
            <Choice key={s} active={s === size} onClick={() => setSize(s)}>
              {s}
            </Choice>
          ))}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          {preview.length} hostile{preview.length === 1 ? "" : "s"}:{" "}
          {preview.map((m) => m.name).join(", ")}
        </p>
      </Field>

      <Field label="Starting condition">
        <div className="grid gap-2 sm:grid-cols-2">
          {WOUNDS.map((w) => (
            <Choice key={w.value} active={w.value === wound} onClick={() => setWound(w.value)}>
              <span className="block font-semibold">{w.label}</span>
              <span className="block font-mono text-[10px] text-muted-foreground">{w.note}</span>
            </Choice>
          ))}
        </div>
        <Choice active={emptyMagazines} onClick={() => setEmptyMagazines((v) => !v)}>
          <span className="block font-semibold">
            {emptyMagazines ? "Magazines emptied" : "Magazines as carried"}
          </span>
          <span className="block font-mono text-[10px] text-muted-foreground">
            empty every gun, to reach Reload and the empty-weapon refusal
          </span>
        </Choice>
      </Field>

      {start.error && <p className="text-sm text-destructive">{(start.error as Error).message}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={() => start.mutate()} disabled={!chosen || start.isPending}>
          {start.isPending ? "Setting the board…" : "Start the fight"}
        </Button>
        <Button asChild variant="outline">
          <Link to="/roster">Back to the roster</Link>
        </Button>
      </div>
    </div>
  );
}
