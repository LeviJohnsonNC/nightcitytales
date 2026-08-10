import type { CreationMethod } from "@/engine";
import { CyberwarePanel } from "./CyberwarePanel";
import { DerivedPanel } from "./DerivedPanel";
import { GearPanel } from "./GearPanel";
import { IdentityPanel } from "./IdentityPanel";
import { LifepathPanel } from "./LifepathPanel";
import { LifestylePanel } from "./LifestylePanel";
import { MethodPanel } from "./MethodPanel";
import { ReviewPanel } from "./ReviewPanel";
import { RolePanel } from "./RolePanel";
import { RollLog } from "./RollLog";
import { SkillsPanel } from "./SkillsPanel";
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
  switch (step) {
    case "method":
      return <MethodPanel state={state} onRequestMethod={onRequestMethod} />;

    case "role":
      return <RolePanel state={state} onRequestRole={onRequestRole} />;

    case "derived":
      return <DerivedPanel state={state} />;

    case "identity":
      return <IdentityPanel state={state} />;

    case "review":
      return <ReviewPanel state={state} />;

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
      return <SkillsPanel state={state} />;
    case "gear":
      return <GearPanel state={state} />;
    case "cyberware":
      return <CyberwarePanel state={state} />;
    case "lifestyle":
      return <LifestylePanel state={state} />;
  }
}