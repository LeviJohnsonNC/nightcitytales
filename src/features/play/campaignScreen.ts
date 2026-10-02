/** Combat temporarily owns the screen; it does not become a campaign phase. */
export function campaignScreen(input: {
  phase: string;
  status: string;
  opening: boolean;
  combat: boolean;
}): "play" | "opening" | "life" {
  if (input.status === "lost" || input.combat) return "play";
  if (input.opening) return "opening";
  return input.phase === "job" || input.phase === "aftermath" ? "play" : "life";
}
