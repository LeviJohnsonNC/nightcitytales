/**
 * The meet, the fixer's line, the file and the reveal, drawn.
 *
 * None of these can be reached in CI through the real route, which needs a
 * signed-in session, so this renders each one against a plain draft and pins
 * what the player is meant to see: three real fixers with faces, the chosen
 * fixer's own words, and on the reveal the three people the campaign will seed.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fixerCandidates } from "@/engine";
import { CharacterFile } from "../CharacterFile";
import { FixerLine } from "../FixerLine";
import { FixerMeet } from "../FixerMeet";
import { fixerVoice } from "../interview";
import { Reveal } from "../Reveal";
import { castForState } from "../revealModel";
import { useChargenStore, type ChargenState } from "../store";

const SEED = 4242;
const ROOM = fixerCandidates(SEED);
const FIXER = ROOM[0]!;

function draft(over: Partial<ChargenState> = {}): ChargenState {
  return { ...useChargenStore.getState(), ...over };
}

/** React escapes quotes in markup; compare against the same escaping. */
function escaped(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

describe("the meet, drawn", () => {
  it("shows three fixers with their faces, and the chosen one's greeting", () => {
    const html = renderToStaticMarkup(
      <FixerMeet state={draft({ castPlan: { seed: SEED, picks: { fixer: FIXER } } })} />,
    );
    for (const name of ROOM) expect(html).toContain(escaped(name));
    // Each fixer is drawn in their own venue at the meet, not in the square-on cast portrait.
    expect(html.match(/meet-[a-z-]+\.webp/g)?.length).toBeGreaterThanOrEqual(ROOM.length);
    expect(html).toContain(escaped(fixerVoice(FIXER)!.greeting));
    expect(html).toContain("Your fixer");
  });

  it("draws nothing until the room is dealt", () => {
    expect(renderToStaticMarkup(<FixerMeet state={draft({ castPlan: null })} />)).toBe("");
  });
});

describe("the fixer's line", () => {
  it("asks the step's question in the fixer's voice, with their face", () => {
    const html = renderToStaticMarkup(<FixerLine fixer={FIXER} step="skills" roleId="solo" />);
    expect(html).toContain(escaped(fixerVoice(FIXER)!.ask.skills!));
    expect(html).toContain("/images/cast/");
  });

  it("is silent with no fixer", () => {
    expect(renderToStaticMarkup(<FixerLine fixer={null} step="skills" roleId={null} />)).toBe("");
  });
});

describe("the file", () => {
  it("says who is keeping it, and who it is about", () => {
    const html = renderToStaticMarkup(
      <CharacterFile
        state={draft({
          handle: "Static",
          name: "Vic Salas",
          roleId: "solo",
          castPlan: { seed: SEED, picks: { fixer: FIXER } },
        })}
      />,
    );
    expect(html).toContain("Static");
    expect(html).toContain("Vic Salas · Solo");
    expect(html).toContain("Kept by");
    expect(html).toContain("No photo on file");
  });
});

describe("the reveal", () => {
  it("names the character and the three people already waiting", () => {
    const state = draft({
      handle: "Static",
      name: "Vic Salas",
      roleId: "solo",
      castPlan: { seed: SEED, picks: { fixer: FIXER } },
    });
    const html = renderToStaticMarkup(<Reveal state={state} homePlaceKey={null} />);
    expect(html).toContain("Static");
    const cast = castForState(state);
    for (const role of ["enemy", "friend", "old_flame"] as const) {
      expect(html).toContain(escaped(cast.find((m) => m.role === role)!.name));
    }
    expect(html).toContain("Wants you dead");
    expect(html).toContain(escaped(fixerVoice(FIXER)!.verdict));
  });
});
