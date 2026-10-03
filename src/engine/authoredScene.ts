import type { CombatSide } from "./encounter";
import type { Point } from "./battlefield";
import type { ThreatProfile } from "./threats";
import type { BattlefieldSnapshot } from "./battlefieldSnapshot";

export type SceneActor = {
  id: string;
  name: string;
  side: CombatSide;
  position: Point;
  /** Snapshot the mechanical profile rather than reinterpreting the weapon later. */
  profile: ThreatProfile | null;
};
export type AuthoredScene = {
  context?: import("./sceneFacts").SceneContext;
  template: string;
  templateVersion: number;
  locationKey: string;
  anchor: string;
  narration: string;
  layout: BattlefieldSnapshot;
  actors: SceneActor[];
};
