/**
 * Whether developer tooling is reachable in this build.
 *
 * `/combat` seeds a real encounter into a real campaign through the real
 * `beginEncounter` — which is exactly what makes it a good harness and exactly
 * what makes it wrong to ship. Deployed, it let any signed-in player put their
 * campaign into a state the loop never produces: an arena, a force and a wound
 * state of their choosing, with no hook and no job behind it.
 *
 * It was deliberately NOT gated on `import.meta.env.DEV`, because the reason it
 * exists is to be used on the deployed preview, and DEV is false there. That
 * reasoning is right, and the answer is a flag rather than no gate:
 *
 *  - local `bun run dev` — on, no configuration, because that is where it is
 *    used most and a harness you have to switch on is a harness you stop using;
 *  - a deployed preview — on when `VITE_COMBAT_HARNESS` is set to "1";
 *  - production — off, because nothing is set.
 *
 * Read through one helper rather than at the call site so there is one answer to
 * change when the question changes.
 */
export function harnessEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  return import.meta.env["VITE_COMBAT_HARNESS"] === "1";
}
