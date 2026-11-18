import { Button } from "@/components/ui/button";
import type { Beat, BeatExit } from "@/engine";

export function EvidenceDecision({
  beat,
  exits,
  fee,
  busy,
  onChoose,
}: {
  beat: Beat;
  exits: BeatExit[];
  fee: number;
  busy: boolean;
  onChoose: (exit: BeatExit) => void;
}) {
  return (
    <section
      aria-labelledby="evidence-question"
      className="space-y-3 border border-accent bg-card p-4"
    >
      <h3 id="evidence-question" className="text-base font-bold">
        {beat.title}
      </h3>
      <p className="text-sm">{beat.playerBrief}</p>
      <p className="num text-sm text-muted-foreground">Client fee · {fee}eb</p>
      <div className="grid gap-2">
        {exits.map((exit) => (
          <Button
            key={exit.to}
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onChoose(exit)}
            className="h-auto min-h-11 justify-start whitespace-normal py-2 text-left"
          >
            {exit.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
