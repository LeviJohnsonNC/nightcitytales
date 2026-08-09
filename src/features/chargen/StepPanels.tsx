import rolesData from "@/data/rules/roles.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CREATION_METHODS, CREATION_RULES, STAT_ORDER, deriveStats } from "@/engine";
import type { CreationMethod, StatBlock } from "@/engine";
import { useChargenStore, type ChargenState } from "./store";
import type { ChargenStep } from "./steps";

const ROLES = Object.values(rolesData.roles as Record<string, { id: string; name: string; tagline: string }>);

const METHOD_ORDER: { id: CreationMethod; label: string; detail: string }[] = [
  {
    id: "streetrat",
    label: CREATION_METHODS.streetrat.label,
    detail: CREATION_METHODS.streetrat.statMethod,
  },
  {
    id: "edgerunner",
    label: CREATION_METHODS.edgerunner.label,
    detail: CREATION_METHODS.edgerunner.statMethod,
  },
  {
    id: "complete_package",
    label: CREATION_METHODS.completePackage.label,
    detail: `${CREATION_METHODS.completePackage.statPoints} STAT Points, ${CREATION_METHODS.completePackage.skillPoints} Skill Points`,
  },
];

function OptionCard({
  selected,
  title,
  detail,
  onClick,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "w-full border border-border bg-card p-4 text-left transition-colors hover:border-accent/60",
        selected && "border-accent bg-accent/10",
      )}
    >
      <span className="block text-sm font-semibold tracking-tight">{title}</span>
      <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {detail}
      </span>
    </button>
  );
}

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
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          {METHOD_ORDER.map((method) => (
            <OptionCard
              key={method.id}
              selected={state.method === method.id}
              title={method.label}
              detail={method.detail}
              onClick={() => onRequestMethod(method.id)}
            />
          ))}
        </div>
      );

    case "role":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((role) => (
            <OptionCard
              key={role.id}
              selected={state.roleId === role.id}
              title={role.name}
              detail={role.tagline}
              onClick={() => onRequestRole(role.id)}
            />
          ))}
        </div>
      );

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
      return (
        <Placeholder step="Lifepath" note="General Lifepath, then the Role-specific Lifepath table." />
      );
    case "stats":
      return (
        <Placeholder
          step="STATs"
          note="This panel branches by creation method: template row, per-STAT roll, or point buy."
        />
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