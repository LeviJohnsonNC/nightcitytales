/**
 * The backdrops and the soundtrack are uploaded by name, so the names in code
 * and the names the guides ask the user to save under must agree. A mismatch
 * would not fail anywhere: the slot would just stay plain forever.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Backdrop } from "../Backdrop";
import { INTERVIEW_FIXERS, fixerVoice } from "../interview";
import { playlist, songOf } from "../music/soundtrack";

const ART_GUIDE = readFileSync("docs/art-style.md", "utf8");
const SOUNDTRACK = readFileSync("docs/soundtrack.md", "utf8");
const CHAPTERS = ["origin", "self", "people", "drive", "work"];

describe("backdrop names", () => {
  it("asks for every venue, scene and chapter the creator shows", () => {
    for (const name of INTERVIEW_FIXERS) {
      const venue = fixerVoice(name)!.venue;
      expect(venue).toMatch(/^venue-[a-z-]+$/);
      expect(ART_GUIDE, venue).toContain(`${venue}.png`);
    }
    for (const scene of ["scene-meet", "scene-reveal"]) expect(ART_GUIDE).toContain(`${scene}.png`);
    for (const c of CHAPTERS) expect(ART_GUIDE).toContain(`chapter-${c}.png`);
  });

  it("gives every fixer a place of their own", () => {
    const venues = INTERVIEW_FIXERS.map((n) => fixerVoice(n)!.venue);
    expect(new Set(venues).size).toBe(venues.length);
  });

  it("renders nothing until the image is uploaded", () => {
    expect(renderToStaticMarkup(<Backdrop name="scene-that-does-not-exist" />)).toBe("");
    expect(renderToStaticMarkup(<Backdrop name={null} />)).toBe("");
  });
});

describe("soundtrack names", () => {
  it("has a written prompt for every track in the rotation", () => {
    // A second take (-v2) shares its song's prompt.
    for (const track of playlist()) {
      expect(SOUNDTRACK, track).toContain(`\`${songOf(track)}.mp3\``);
    }
  });
});
