import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { assembleCharacter } from "@/engine";
import { CharacterSheet } from "@/features/chargen/CharacterSheet";
import { buildFromState } from "@/features/chargen/sheetModel";
import { downloadCharacterJson } from "@/features/chargen/characterExport";
import { getCharacter } from "@/lib/backend";
import { startOrResumeAdventure } from "@/features/play/startAdventure";
import { stateFromCharacter } from "./characterState";
import { useOpenAsDraft } from "./RosterList";

export function CharacterDetail({ id, userId }: { id: string; userId: string }) {
  const { data, isPending, error } = useQuery({
    queryKey: ["character", id],
    queryFn: () => getCharacter(id),
  });
  const edit = useOpenAsDraft(userId);
  const navigate = useNavigate();
  const start = useMutation({
    mutationFn: () => {
      if (!data) throw new Error("Character not loaded.");
      return startOrResumeAdventure(data.character);
    },
    onSuccess: (campaignId) => navigate({ to: "/play/$id", params: { id: campaignId } }),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Loading character…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data)
    return <p className="text-sm text-muted-foreground">That character no longer exists.</p>;

  const state = stateFromCharacter(data);
  const build = buildFromState(state);
  const sheet = assembleCharacter(build);

  return (
    <div className="space-y-6">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <Link
          to="/roster"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to roster
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            {start.isPending ? "Starting…" : "Start Adventure"}
          </Button>
          <Button variant="outline" onClick={() => edit.mutate({ id })} disabled={edit.isPending}>
            {edit.isPending ? "Opening…" : "Edit in wizard"}
          </Button>
          <Button
            variant="outline"
            onClick={() => edit.mutate({ id, name: `${data.character.name} (copy)` })}
            disabled={edit.isPending}
          >
            Duplicate
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="outline" onClick={() => downloadCharacterJson(state, build, sheet)}>
            Export JSON
          </Button>
        </div>
      </header>

      {start.error && <p className="text-sm text-destructive">{(start.error as Error).message}</p>}
      {edit.error && <p className="text-sm text-destructive">{(edit.error as Error).message}</p>}
      <p className="no-print text-sm text-muted-foreground">
        Editing opens the wizard on a fresh draft copied from this character, so the saved sheet
        stays intact until you save the edited version.
      </p>

      <CharacterSheet
        state={state}
        build={build}
        sheet={sheet}
        improvementPoints={data.finance?.improvement_points ?? 0}
      />
    </div>
  );
}
