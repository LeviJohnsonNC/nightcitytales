import type { CreationMethod } from "@/engine";
import { CyberwarePanel } from "./CyberwarePanel";
import { GearPanel } from "./GearPanel";
import { IdentityPanel } from "./IdentityPanel";
import { LifepathPanel } from "./LifepathPanel";
import { LifestylePanel } from "./LifestylePanel";
import { FixerMeet } from "./FixerMeet";
import { MethodPanel } from "./MethodPanel";
import { ReviewPanel } from "./ReviewPanel";
import { RolePanel } from "./RolePanel";
import { SkillsPanel } from "./SkillsPanel";
import { StartingGearPanel } from "./StartingGearPanel";
import { StatsPanel } from "./StatsPanel";
import { useChargenStore, type ChargenState } from "./store";
import type { ChargenStep } from "./steps";

export function StepPanel({
  step,
  state,
  userId,
  lead,
  onRequestMethod,
  onRequestRole,
}: {
  step: ChargenStep;
  state: ChargenState;
  userId: string;
  /** The fixer's reaction to the answer that brought the player here, for a step that speaks for them. */
  lead?: string | null;
  /** With `advance`, choosing the terms also moves on to the next step. */
  onRequestMethod: (method: CreationMethod, advance?: boolean) => void;
  /** With `advance`, choosing the Role also moves on to the next step. */
  onRequestRole: (roleId: string, advance?: boolean) => void;
}) {
  switch (step) {
    case "fixer":
      return <FixerMeet state={state} />;

    case "method":
      return <MethodPanel state={state} onRequestMethod={onRequestMethod} />;

    case "role":
      return <RolePanel state={state} onRequestRole={onRequestRole} />;

    case "identity":
      return <IdentityPanel state={state} userId={userId} />;

    case "review":
      return <ReviewPanel state={state} />;

    case "lifepath":
      return <LifepathPanel state={state} lead={lead} />;
    case "stats":
      return <StatsPanel state={state} />;

    case "skills":
      return <SkillsPanel state={state} />;
    case "package":
      return <StartingGearPanel state={state} />;
    case "gear":
      return <GearPanel state={state} />;
    case "cyberware":
      return <CyberwarePanel state={state} />;
    case "lifestyle":
      return <LifestylePanel state={state} />;
  }
}
