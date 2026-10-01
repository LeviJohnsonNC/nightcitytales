/**
 * Whether the picture is open: the opening and a fresh arrival open it on their
 * own, and a click overrides whichever it is until the next arrival.
 */
export function sceneOpen(input: {
  opening: boolean;
  arrived: boolean;
  /** What the player last chose, or null to leave it to the game. */
  override: boolean | null;
}): boolean {
  return input.override ?? (input.opening || input.arrived);
}
