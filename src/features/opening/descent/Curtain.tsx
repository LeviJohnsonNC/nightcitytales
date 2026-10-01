/**
 * The fade to black that starts the descent: the Reveal's own screen going out
 * under the player's finger, so the cut into the city is a cut and not a page
 * load. The route's descent picks up from the same clock.
 */
import "./descent.css";

export function Curtain() {
  return <div aria-hidden className="dsc-curtain fixed inset-0 z-50 bg-[#06040f]" />;
}
