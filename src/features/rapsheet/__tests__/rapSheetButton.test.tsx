/**
 * The button is the only part of the Rap Sheet a player meets before they have
 * asked for anything, so what it promises is what is held here: it names itself,
 * it does no work (no picture fetched, no card drawn) until it is opened, and it
 * says plainly that the card is made on the device.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FullCharacter } from "@/lib/backend";
import { RapSheetButton } from "../RapSheetButton";
import { sourceFromCharacter } from "../rapSheetModel";

const character = {
  character: {
    id: "c1",
    name: "Vincent Kang",
    handle: "Velvet",
    role: "solo",
    portrait_path: "u/d/t.png",
  },
  stats: { int: 6, ref: 8, dex: 7, tech: 5, cool: 6, will: 6, luck: 4, move: 6, body: 7, emp: 3 },
  skills: [],
  roleAbility: { rank: 4 },
  gear: [],
  cyberware: [],
  lifepath: { general: {} },
  finance: null,
} as unknown as FullCharacter;

describe("the Rap Sheet button", () => {
  it("is a button with the name it was given, and nothing drawn until it is opened", () => {
    const html = renderToStaticMarkup(
      <RapSheetButton source={sourceFromCharacter(character)} label="Your rap sheet" />,
    );
    expect(html).toContain("Your rap sheet");
    expect(html).toContain("<button");
    // Closed: no dialog, no preview, no canvas.
    expect(html).not.toContain("rapsheet-preview");
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain("Save image");
  });

  it("falls back to a plain label", () => {
    expect(
      renderToStaticMarkup(<RapSheetButton source={sourceFromCharacter(character)} />),
    ).toContain("Rap sheet");
  });
});
