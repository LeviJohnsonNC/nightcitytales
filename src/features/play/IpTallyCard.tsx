/**
 * Declaring how you played, and what the table said it was worth.
 *
 * One card for both kinds of award — a job closing in Aftermath, and a stretch
 * of life between jobs — because the act is the same: the player names their
 * two playstyles, the GM picks printed tiers, the engine computes the number.
 * Presentational only; the caller owns the mutation.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IP_PLAYSTYLES, type IpPlaystyle } from "@/engine";
import type { IpTally, Playstyles } from "@/features/campaign/ipAward";

export function IpTallyCard({
  heading,
  awarded = null,
  tally,
  busy,
  error,
  defaults,
  onTally,
  onDismiss,
}: {
  /** What is being judged, in a line: "declare how you played". */
  heading: string;
  /** I.P. already paid for this, shown instead of the pickers. */
  awarded?: number | null;
  tally: IpTally | null;
  busy: boolean;
  error: Error | null;
  /** What the player declared last time, so they are not asked from scratch. */
  defaults?: Playstyles | null;
  onTally: (playstyles: Playstyles) => void;
  onDismiss?: () => void;
}) {
  const [primary, setPrimary] = useState<IpPlaystyle>(defaults?.primary ?? "warrior");
  const [secondary, setSecondary] = useState<IpPlaystyle>(defaults?.secondary ?? "roleplayer");

  if (awarded !== null && !tally) {
    return (
      <p className="num text-sm">
        Improvement Points: <span className="font-bold">{awarded} IP</span> (already awarded)
      </p>
    );
  }

  if (tally) {
    return (
      <div className="space-y-1 border border-accent/50 bg-accent/5 p-3 text-sm">
        <p className="num">
          Improvement Points: <span className="font-bold">+{tally.award.ip} IP</span>{" "}
          <span className="text-muted-foreground">
            ({tally.award.source} column{tally.award.fromStandout ? ", standout" : ""})
          </span>
        </p>
        <p className="text-muted-foreground">{tally.award.descriptor}</p>
        <p className="italic">{tally.judgement.reason}</p>
        {tally.award.fromStandout && tally.judgement.standout && (
          <p className="text-muted-foreground">Standout: {tally.judgement.standout.reason}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="num text-muted-foreground">Banked: {tally.total} IP</p>
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Done
            </Button>
          )}
        </div>
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
        Improvement Points — {heading}
      </p>
      <div className="flex flex-wrap gap-3">
        <Picker label="Primary" value={primary} onChange={setPrimary} />
        <Picker label="Secondary" value={secondary} onChange={setSecondary} />
        <Button size="sm" disabled={busy} onClick={() => onTally({ primary, secondary })}>
          {busy ? "Tallying…" : "Tally IP"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
    </div>
  );
}
