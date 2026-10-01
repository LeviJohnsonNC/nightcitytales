/**
 * The file's picture as the player sees it: a finished one opens, one still
 * developing does not give itself away, the hand-over keeps the old picture
 * under the new, and the Identity page has no portrait of its own.
 */
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CharacterFile } from "../CharacterFile";
import { IdentityPanel } from "../IdentityPanel";
import { useChargenStore, type ChargenState } from "../store";
import type { DevelopingPortrait } from "../useDevelopingPortrait";

afterEach(() => useChargenStore.getState().reset());

function draft(over: Partial<ChargenState> = {}): ChargenState {
  return { ...useChargenStore.getState(), method: "edgerunner", ...over };
}

const landed: DevelopingPortrait = {
  preview: null,
  latest: { key: "path:u/d/p.png", src: "data:image/png;base64,x", path: "u/d/p.png" },
  developing: null,
  failed: null,
  stalled: false,
  retry() {},
};

describe("the picture on the print", () => {
  it("is anchored to the top of the portrait and not zoomed past the window", () => {
    const html = renderToStaticMarkup(
      <CharacterFile
        state={draft({ portraitPath: "u/d/p.png", portraitStage: 3 })}
        developing={landed}
      />,
    );
    expect(html).toContain("object-position:50% 5%");
    expect(html).not.toContain("scale-105");
    expect(html).toContain("object-cover");
  });

  it("does not open a picture that is still developing, which would show it sharp", () => {
    const html = renderToStaticMarkup(
      <CharacterFile
        state={draft({ portraitPath: "u/d/p.png", portraitStage: 3 })}
        developing={landed}
      />,
    );
    // No steps answered in this draft: the file is still at its floor.
    expect(html).not.toContain("full size");
  });

  it("develops the first picture out of black, and a later one over the last", () => {
    const html = renderToStaticMarkup(
      <CharacterFile
        state={draft({ portraitPath: "u/d/p.png", portraitStage: 1 })}
        developing={landed}
      />,
    );
    expect(html).toContain("cg-develop");
    expect(html).not.toContain("cg-fade-in");
  });
});

describe("the Identity page", () => {
  it("asks for a name and a handle, and has no portrait to draw", () => {
    const html = renderToStaticMarkup(<IdentityPanel state={draft({ roleId: "solo" })} />);
    expect(html).toContain("Handle");
    expect(html).not.toContain("Regenerate portrait");
    expect(html).not.toContain("Generate portrait");
    expect(html).not.toContain("Portrait take");
    expect(html).not.toContain(">Portrait<");
  });
});
