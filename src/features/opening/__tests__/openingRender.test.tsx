import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OPENING_CHOICES } from "@/engine";
import type { Opening } from "../openingResponse";

/**
 * The first screen, server-rendered.
 *
 * This is the one screen in the game where a thrown component is unrecoverable
 * for the player: it is the first thing they see, and there is nothing behind
 * it to fall back to. `renderToStaticMarkup` needs no DOM, so proving it draws
 * costs the suite nothing.
 */

const opening: Opening = {
  title: "The Sixth Floor",
  paragraphs: [
    "The lift has been out for a week and the stairwell smells like burnt synth-oil.",
    "Two floors down, a door closes hard enough to shake the rail under your hand.",
  ],
  doors: OPENING_CHOICES.map((choice, i) => ({
    choice,
    label: `Door ${i + 1}`,
    line: `What door ${i + 1} means tonight.`,
  })),
};

type ScreenState = {
  opening: Opening | null;
  writing: boolean;
  error: Error | null;
  retry: () => void;
  choose: () => void;
  choosing: boolean;
  chooseError: Error | null;
  character: never;
};

/** The mock reads this on every call, so moving it moves the screen. */
const state: ScreenState = {
  opening,
  writing: false,
  error: null,
  retry: vi.fn(),
  choose: vi.fn(),
  choosing: false,
  chooseError: null,
  character: {
    character: { name: "Mara Vance", handle: "Sundown", role: "solo" },
  } as never,
};

vi.mock("../useOpening", () => ({ useOpening: () => state }));

const { OpeningScreen, OpeningStage } = await import("../OpeningScreen");

const render = () => renderToStaticMarkup(<OpeningScreen campaignId="c1" />);
const renderStage = () => renderToStaticMarkup(<OpeningStage open={state as never} />);

describe("the cold open draws", () => {
  const html = renderStage();

  it("shows the night's title and every paragraph", () => {
    expect(html).toContain("The Sixth Floor");
    for (const paragraph of opening.paragraphs) expect(html).toContain(paragraph);
  });

  it("offers all four doors, numbered", () => {
    for (const door of opening.doors) {
      expect(html).toContain(door.label);
      expect(html).toContain(door.line);
    }
    expect(html).toContain("What do you do first?");
  });

  it("says whose night it is without leading on the name", () => {
    expect(html).toContain("Sundown");
    // The standfirst is furniture; the title and the prose are the page.
    expect(html.indexOf("Sundown")).toBeLessThan(html.indexOf("The Sixth Floor"));
  });

  it("keeps the doors dark until the prose has been read to the end", () => {
    // The pacing is the welcome: a player who has just built a character should
    // read the scene before being asked to act in it. Nothing has been typed yet.
    expect(html.match(/data-lit="no"/g)).toHaveLength(4);
    expect(html).not.toContain('data-lit="yes"');
    expect(html).not.toContain("open-doors-on");
    expect(html).toContain("open-doors");
  });

  it("types the prose for eyes and gives screen readers all of it", () => {
    for (const paragraph of opening.paragraphs) {
      expect(html).toContain(`<span class="sr-only">${paragraph}</span>`);
    }
    expect(html).toContain('aria-hidden="true"');
  });

  it("slams the title down and numbers the doors on key caps", () => {
    expect(html).toContain("open-slam");
    for (let n = 1; n <= 4; n++) expect(html).toContain(`<kbd class="open-key num">${n}</kbd>`);
  });

  it("lights each door in its own colour", () => {
    for (const hue of ["cyan", "pink", "violet", "amber"])
      expect(html).toContain(`data-hue="${hue}"`);
  });
});

describe("while the city is deciding", () => {
  it("is the descent, not a spinner and not the prose", () => {
    state.opening = null;
    state.writing = true;
    const html = render();
    expect(html).toContain("Night City is deciding what kind of night this is");
    expect(html).toContain("Population");
    expect(html).not.toContain("What do you do first?");
  });

  it("starts with the descent even when the prose is already there: the fall is the welcome", () => {
    state.opening = opening;
    state.writing = false;
    const html = render();
    expect(html).toContain("Population");
    expect(html).not.toContain("The Sixth Floor");
  });
});

describe("when the night does not come through", () => {
  it("offers a retry rather than a lesser opening", () => {
    state.opening = null;
    state.writing = false;
    state.error = new Error("The GM stumbled upstream.");
    const html = render();

    expect(html).toContain("The GM stumbled upstream.");
    expect(html).toContain("Try again");
    // The promise the plan made: no stand-in prose, ever.
    expect(html).not.toContain("The lift has been out");
    expect(html).not.toContain("What do you do first?");
  });
});
