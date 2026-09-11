import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { METHOD_COPY } from "@/features/chargen/copy";
import { draftPayload, useChargenStore, type ChargenState } from "@/features/chargen/store";
import {
  deleteCharacter,
  getCharacter,
  listRoster,
  resetAdventureForCharacter,
  saveDraft,
  type Json,
  type RosterEntry,
} from "@/lib/backend";
import { draftStateFromCharacter } from "./characterState";
import { startOrResumeAdventure } from "@/features/play/startAdventure";
import { CharacterCard } from "./CharacterCard";
import { DraftCharacterCard } from "./DraftCharacterCard";

const METHOD_LABELS: Record<string, string> = {
  streetrat: CREATION_METHODS.streetrat.label,
  edgerunner: CREATION_METHODS.edgerunner.label,
  complete_package: CREATION_METHODS.completePackage.label,
};

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
    <section className="space-y-6 border border-hairline/70 bg-surface/50 p-6 backdrop-blur-md">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">No edgerunners yet</h2>
        <p className="mt-1 text-sm text-text-muted">
          Pick how much control you want over the build. You can switch method until you lock a
          Role.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {METHOD_COPY.map((method) => (
          <article key={method.id} className="flex flex-col border border-hairline/70 p-4">
            <h3 className="text-base font-bold">{METHOD_LABELS[method.id]}</h3>
            <p className="mt-1 text-sm font-semibold text-accent">{method.headline}</p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">{method.body}</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
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

export function RosterList({ userId: _userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<RosterEntry | null>(null);
  const [pendingReset, setPendingReset] = useState<RosterEntry | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({ queryKey: ["roster"], queryFn: listRoster });

  // One character is selected by default: the one most recently returned to.
  useEffect(() => {
    if (!selectedId && data && data.length > 0) setSelectedId(data[0].id);
  }, [data, selectedId]);

  const start = useMutation({
    mutationFn: (entry: RosterEntry) => startOrResumeAdventure(entry),
    onSuccess: (campaignId) => navigate({ to: "/play/$id", params: { id: campaignId } }),
  });

  const reset = useMutation({
    mutationFn: (id: string) => resetAdventureForCharacter(id),
    onSuccess: () => {
      setPendingReset(null);
      void queryClient.invalidateQueries({ queryKey: ["roster"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCharacter(id),
    onSuccess: () => {
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["roster"] });
    },
  });

  if (isPending) return <p className="text-sm text-text-muted">Loading roster…</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;

  return (
    <div className="space-y-8">
      <DraftCharacterCard />

      {reset.error && <p className="text-sm text-destructive">{(reset.error as Error).message}</p>}
      {remove.error && (
        <p className="text-sm text-destructive">{(remove.error as Error).message}</p>
      )}
      {start.error && <p className="text-sm text-destructive">{(start.error as Error).message}</p>}

      {data.length === 0 ? (
        <EmptyRoster />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data.map((entry, index) => (
            <CharacterCard
              key={entry.id}
              entry={entry}
              index={index}
              selected={selectedId === entry.id}
              onSelect={() => setSelectedId(entry.id)}
              onStart={() => start.mutate(entry)}
              starting={start.isPending && start.variables?.id === entry.id}
              resetting={reset.isPending && reset.variables === entry.id}
              onReset={() => setPendingReset(entry)}
              onDelete={() => setPendingDelete(entry)}
            />
          ))}
        </div>
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

      <AlertDialog
        open={pendingReset !== null}
        onOpenChange={(open) => !open && setPendingReset(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {pendingReset?.name}&apos;s adventure?</AlertDialogTitle>
            <AlertDialogDescription>
              Every playthrough this character has — the job in progress, live HP and Humanity,
              money earned, loot, contacts, encounters and the whole session log — is wiped. The
              character sheet itself is untouched, and the next Start Adventure begins clean from
              it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingReset && reset.mutate(pendingReset.id)}
              disabled={reset.isPending}
            >
              {reset.isPending ? "Resetting…" : "Yes, reset the adventure"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
