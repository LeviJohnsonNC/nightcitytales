/** The shapes `CombatBoard.tsx` hands its parts: each is what the board already computes. */
import type {
  Combatant,
  Point,
  Tile,
  battlefieldFor,
  blockedTiles,
  coverStatuses,
  judgeAction,
  previewAttack,
  previewMovement,
  remainingCombatTurn,
  shotObstacles,
} from "@/engine";
import type { CombatantData, raisedWeapon } from "../encounterModel";
import type { squaresOutline } from "../overlayModel";

export type Project = (p: Point) => Point;
export type BoardArena = ReturnType<typeof battlefieldFor>;
/** One standing or fallen participant, in initiative order. */
export type BoardActor = { actor: Combatant; data: CombatantData };
export type BoardCover = ReturnType<typeof coverStatuses>[number];
export type BoardBlocker = ReturnType<typeof shotObstacles>[number] | null;
export type BlockedSquares = ReturnType<typeof blockedTiles>;
export type ShotPreview = ReturnType<typeof previewAttack>;
export type RoutePreview = ReturnType<typeof previewMovement>;
export type RaisedWeapon = ReturnType<typeof raisedWeapon>;
export type TurnBudget = ReturnType<typeof remainingCombatTurn>;
export type ActionVerdict = ReturnType<typeof judgeAction>;
export type EdgeRun = ReturnType<typeof squaresOutline>;
export type CameraView = { x: number; y: number; zoom: number };
export type BoardSize = { width: number; height: number };
/** One lit square of the reach field, as both renderers draw it. */
export type LitSquare = {
  tile: Tile;
  key: string;
  sheltered: boolean;
  firing: boolean;
  faded: boolean;
};
export type FiringTiles = Map<string, { tile: Tile; dv: number | null }>;
export type GroundPointer = (
  svg: SVGSVGElement,
  e: { clientX: number; clientY: number },
) => Point | null;
