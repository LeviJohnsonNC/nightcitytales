import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import { CREATION_METHODS } from "@/engine";
import { ArtSlot } from "@/features/chargen/ArtSlot";
import { portraitArt, portraitById } from "@/features/chargen/art";
import { PortraitLightbox } from "@/features/chargen/PortraitLightbox";
import { usePortraitUrl } from "@/features/chargen/usePortraitUrl";
import { METHOD_COPY } from "@/features/chargen/copy";
import { stepDefinition, type ChargenStep } from "@/features/chargen/steps";
import { draftPayload, useChargenStore, type ChargenState } from "@/features/chargen/store";
import rolesData from "@/data/rules/roles.json";
import {
  deleteCharacter,
  getCharacter,
  getLatestDraft,
  listRoster,
  saveDraft,
  type Json,
  type RosterEntry,
} from "@/lib/backend";
import { draftStateFromCharacter } from "./characterState";
import { startOrResumeAdventure } from "@/features/play/startAdventure";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

const METHOD_LABELS: Record<string, string> = {
  streetrat: CREATION_METHODS.streetrat.label,
  edgerunner: CREATION_METHODS.edgerunner.label,
  complete_package: CREATION_METHODS.completePackage.label,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="num text-lg font-bold leading-tight">{value}</p>
    </div>
  );
}

function pair(current: number | null | undefined, max: number | null | undefined): string {
  if (typeof current !== "number" && typeof max !== "number") return "—";
  return `${current ?? max ?? "—"} / ${max ?? "—"}`;
}

/** Opens the wizard against a draft seeded from an existing character. */
export function useOpenAsDraft(userId: string) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      const full = await getCharacter(id);
      if (!full) throw new Error("That character no longer exists.");
      const state: ChargenState = draftStateFromCharacter(full, name);
      const draft = await saveDraft(userId, draftPayload(state) as unknown as Json);
      useChargenStore.getState().hydrate({ ...state, draftId: draft.id });
      return draft.id;
    },
    onSuccess: () => navigate({ to: "/create" }),
  });
}

function EmptyRoster() {
  return (
    <section className="space-y-6 border border-border bg-card p-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">No edgerunners yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick how much control you want over the build. You can switch method until you lock a
          Role.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {METHOD_COPY.map((method) => (
          <article key={method.id} className="flex flex-col border border-border p-4">
            <h3 className="text-base font-bold">{METHOD_LABELS[method.id]}</h3>
            <p className="mt-1 text-sm font-semibold text-accent">{method.headline}</p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {method.body}
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {method.choice} choice · {method.time}
            </p>
          </article>
        ))}
      </div>
      <Button asChild>
        <Link to="/create">Create your first character</Link>
      </Button>
    </section>
  );
}

function DraftCard() {
  const { data } = useQuery({ queryKey: ["chargen-draft"], queryFn: getLatestDraft });
  if (!data) return null;
  const state = (data.state ?? {}) as Partial<ChargenState>;
  const step = (state.step ?? "method") as ChargenStep;
  const def = stepDefinition(step);
  const roleName = state.roleId ? (ROLE_NAMES[state.roleId]?.name ?? state.roleId) : null;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 border border-accent/60 bg-accent/10 p-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          Unfinished draft
        </p>
        <p className="mt-1 text-sm font-semibold">
          {state.name?.trim() || "Unnamed character"}
          {roleName ? ` — ${roleName}` : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          Stopped on step {String(def.index).padStart(2, "0")} · {def.title}
        </p>
      </div>
      <Button asChild>
        <Link to="/create">Resume draft</Link>
      </Button>
    </section>
  );
}

function CharacterCard({
  entry,
  onStart,
  onReset,
  onDelete,
  resetting,
  starting,
}: {
  entry: RosterEntry;
  onStart: () => void;
  onReset: () => void;
  onDelete: () => void;
  resetting: boolean;
  starting: boolean;
}) {
  const portrait = entry.portrait_id ? portraitById(entry.portrait_id) : undefined;
  const generated = usePortraitUrl(entry.portrait_path);
  const roleName = ROLE_NAMES[entry.role]?.name ?? entry.role;

  return (
    <article className="flex flex-col border border-border bg-card">
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 p-4">
        <div className="aspect-[3/4] w-full">
          {generated ? (
            <PortraitLightbox
              src={generated}
              alt={`${entry.name} portrait`}
              subtitle={entry.handle ? `"${entry.handle}"` : undefined}
              className="h-full w-full"
            >
              <img
                src={generated}
                alt={`${entry.name} portrait`}
                className="h-full w-full object-cover"
              />
            </PortraitLightbox>
          ) : portrait ? (
            <PortraitLightbox
              src={portraitArt(portrait).src}
              alt={`${entry.name} portrait`}
              subtitle={entry.handle ? `"${entry.handle}"` : undefined}
              className="h-full w-full"
            >
              <ArtSlot art={portraitArt(portrait)} label={entry.name} />
            </PortraitLightbox>
          ) : (
            <div className="flex h-full items-center justify-center border border-dashed border-border text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              No portrait
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            {roleName}
          </p>
          <h3 className="truncate text-lg font-bold leading-tight">{entry.name}</h3>
          <p className="truncate text-sm text-muted-foreground">
            {entry.handle ? `"${entry.handle}"` : "no handle"}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {METHOD_LABELS[entry.creation_method] ?? entry.creation_method}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="HP" value={pair(entry.stats?.hp_current, entry.stats?.hp_max)} />
            <Stat
              label="Humanity"
              value={pair(entry.stats?.humanity_current, entry.stats?.humanity_max)}
            />
          </div>
          <p className="pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Created {formatDate(entry.created_at)}
          </p>
        </div>
      </div>

      {/* Primary action slot — "Start Adventure" lands here once play exists. */}
      <div className="mt-auto border-t border-border p-3">
        <Button className="w-full" onClick={onStart} disabled={starting}>
          {starting ? "Starting…" : "Start Adventure"}
        </Button>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link to="/character/$id" params={{ id: entry.id }}>
              Open sheet
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} disabled={resetting}>
            {resetting ? "Resetting…" : "Reset adventure"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}

export function RosterList({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<RosterEntry | null>(null);

  const { data, isPending, error } = useQuery({ queryKey: ["roster"], queryFn: listRoster });
  const duplicate = useOpenAsDraft(userId);

  const start = useMutation({
    mutationFn: (entry: RosterEntry) => startOrResumeAdventure(entry),
    onSuccess: (campaignId) => navigate({ to: "/play/$id", params: { id: campaignId } }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCharacter(id),
    onSuccess: () => {
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["roster"] });
    },
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Loading roster…</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;

  return (
    <div className="space-y-6">
      <DraftCard />

      {duplicate.error && (
        <p className="text-sm text-destructive">{(duplicate.error as Error).message}</p>
      )}
      {remove.error && (
        <p className="text-sm text-destructive">{(remove.error as Error).message}</p>
      )}
      {start.error && <p className="text-sm text-destructive">{(start.error as Error).message}</p>}

      {data.length === 0 ? (
        <EmptyRoster />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {data.length} saved · most recently updated first
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/create" })}>
              New character
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((entry) => (
              <CharacterCard
                key={entry.id}
                entry={entry}
                onStart={() => start.mutate(entry)}
                starting={start.isPending && start.variables?.id === entry.id}
                duplicating={duplicate.isPending && duplicate.variables?.id === entry.id}
                onDuplicate={() => duplicate.mutate({ id: entry.id, name: `${entry.name} (copy)` })}
                onDelete={() => setPendingDelete(entry)}
              />
            ))}
          </div>
        </>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} and every STAT, Skill, gear and Lifepath record attached to them
              are removed for good. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Deleting…" : `Delete ${pendingDelete?.name ?? ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
