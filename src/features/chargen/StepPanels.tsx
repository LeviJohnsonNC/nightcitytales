import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CREATION_RULES, STAT_ORDER, deriveStats } from "@/engine";
import type { CreationMethod, StatBlock } from "@/engine";
import { LifepathPanel } from "./LifepathPanel";
import { MethodPanel } from "./MethodPanel";
import { RolePanel } from "./RolePanel";
import { RollLog } from "./RollLog";
import { StatsPanel } from "./StatsPanel";
import { useChargenStore, type ChargenState } from "./store";
import type { ChargenStep } from "./steps";

function Placeholder({ step, note }: { step: string; note: string }) {
  return (
    <div className="border border-dashed border-border bg-card/50 p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {step} — panel pending
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

function DerivedPanel({ state }: { state: ChargenState }) {
  const complete = STAT_ORDER.every((s) => typeof state.stats[s] === "number");
  if (!complete) {
    return (
      <Placeholder
        step="Derived STATs"
        note="These fill in automatically once every STAT has a value."
      />
    );
  }
  const stats = state.stats as StatBlock;
  const derived = deriveStats(stats);
  const rows = [
    { label: "Hit Points", value: derived.hpMax, math: CREATION_RULES.derivedStats.hitPoints },
    {
      label: "Seriously Wounded",
      value: derived.seriouslyWoundedThreshold,
      math: CREATION_RULES.derivedStats.seriouslyWoundedThreshold,
    },
    { label: "Death Save", value: derived.deathSave, math: CREATION_RULES.derivedStats.deathSave },
    { label: "Humanity", value: derived.humanityMax, math: CREATION_RULES.derivedStats.humanity },
  ];
  return (
    <dl className="divide-y divide-border border border-border bg-card">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-4 p-4">
          <dt className="w-44 shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {row.label}
          </dt>
          <dd className="font-mono text-2xl font-bold tabular-nums text-foreground">{row.value}</dd>
          <span className="ml-auto text-right font-mono text-[11px] text-muted-foreground">
            {row.math}
          </span>
        </div>
      ))}
    </dl>
  );
}

export function StepPanel({
  step,
  state,
  onRequestMethod,
  onRequestRole,
}: {
  step: ChargenStep;
  state: ChargenState;
  onRequestMethod: (method: CreationMethod) => void;
  onRequestRole: (roleId: string) => void;
}) {
  const patch = useChargenStore((s) => s.patch);

  switch (step) {
    case "method":
      return <MethodPanel state={state} onRequestMethod={onRequestMethod} />;

    case "role":
      return <RolePanel state={state} onRequestRole={onRequestRole} />;

    case "derived":
      return <DerivedPanel state={state} />;

    case "identity":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="chargen-name">Name</Label>
            <Input
              id="chargen-name"
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Legal name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chargen-handle">Handle</Label>
            <Input
              id="chargen-handle"
              value={state.handle}
              onChange={(e) => patch({ handle: e.target.value })}
              placeholder="Street handle"
            />
          </div>
          <div className="sm:col-span-2">
            <Placeholder step="Portrait gallery" note="Portrait selection arrives in a later pass." />
          </div>
        </div>
      );

    case "review":
      return (
        <div className="space-y-3">
          <Placeholder
            step="Final sheet"
            note="The full read-only sheet renders here once the earlier steps are built."
          />
          <Button disabled>Save to roster</Button>
        </div>
      );

    case "lifepath":
      return <LifepathPanel state={state} />;
    case "stats":
      return (
        <div className="space-y-6">
          <StatsPanel state={state} />
          <RollLog />
        </div>
      );
    case "skills":
      return (
        <Placeholder
          step="Skills"
          note="Fixed package, Role-limited point spend, or open point spend, depending on method."
        />
      );
    case "gear":
      return <Placeholder step="Gear & Armor" note="Fixed package or eurobuck shopping." />;
    case "cyberware":
      return (
        <Placeholder step="Cyberware" note="Installing cyberware applies Humanity Loss to the sheet." />
      );
    case "lifestyle":
      return <Placeholder step="Outfit, Lifestyle & Housing" note="Fashion, housing, and lifestyle." />;
  }
}