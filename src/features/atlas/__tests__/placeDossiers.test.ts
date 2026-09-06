import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISTRICTS, districtOfPlace, getDistrict, getPlace } from "@/engine";
import { PLACE_DOSSIERS, placeArtwork, placeDossier } from "../placeDossiers";

const PUBLIC = join(process.cwd(), "public");
const PLACES = join(PUBLIC, "images", "places");

/** Every file in the places directory, whatever its extension. */
function pictureFiles(): string[] {
  return readdirSync(PLACES).filter((f) => !f.startsWith("."));
}

/** Every slug that has been encoded, read off the full-width files. */
function encodedSlugs(): string[] {
  return pictureFiles()
    .filter((f) => f.endsWith(".webp") && !f.endsWith("-640.webp"))
    .map((f) => f.slice(0, -".webp".length));
}

/** Every URL a srcSet names, so each can be checked against the disk. */
function urlsIn(art: { src: string; srcSet: string }): string[] {
  const fromSet = art.srcSet.split(",").map((part) => part.trim().split(/\s+/)[0]!);
  return [...new Set([art.src, ...fromSet])];
}

describe("place dossiers", () => {
  it("is keyed on places the atlas actually has", () => {
    // A typo here would show the reader nothing at all, silently, because the
    // dossier falls back to the atlas blurb when it finds no entry.
    for (const key of Object.keys(PLACE_DOSSIERS)) {
      const known = getPlace(key) ?? getDistrict(key);
      expect(known, `${key} is not a district or location in the atlas`).toBeDefined();
    }
  });

  it("has a picture on disk for every entry that names one, at every width", () => {
    // The slug is written by hand and the files are written by a script, so
    // nothing but this stops the two from drifting apart into a broken image.
    // Both widths are checked: a srcSet naming a file that is not there fails
    // silently in the browser, and only on the displays that ask for it.
    for (const [key, entry] of Object.entries(PLACE_DOSSIERS)) {
      const art = placeArtwork(entry);
      if (!art) continue;
      for (const url of urlsIn(art)) {
        expect(existsSync(join(PUBLIC, url)), `${key} points at ${url}, which is missing`).toBe(
          true,
        );
      }
    }
  });

  it("uses every picture on disk", () => {
    // The other direction: a file nobody points at is a picture that was made
    // and then never reached a reader, usually because a slug was misspelt.
    const named = new Set(
      Object.values(PLACE_DOSSIERS)
        .map((e) => e.image)
        .filter(Boolean),
    );
    const orphans = encodedSlugs().filter((slug) => !named.has(slug));
    expect(orphans).toEqual([]);
  });

  it("leaves no picture behind at only one of the two widths", () => {
    // The pair is what makes srcSet work. A slug encoded at one width only is
    // either a half-finished conversion or a file the script never saw, and
    // both read as a working image right up until a display asks for the other.
    const files = new Set(pictureFiles());
    for (const slug of encodedSlugs()) {
      expect(files.has(`${slug}.webp`), `${slug} has no full-width file`).toBe(true);
      expect(files.has(`${slug}-640.webp`), `${slug} has no 640w file`).toBe(true);
    }
  });

  it("ships no PNGs in the places directory", () => {
    // 563MB of them, for pictures drawn into cards 225 pixels wide. If one
    // reappears it is a file added by hand that the conversion never saw.
    const strays = pictureFiles().filter((f) => f.endsWith(".png"));
    expect(strays).toEqual([]);
  });

  it("covers every location of every district it covers at all", () => {
    // A district with an entry but a location without one is the case that
    // reads worst: the list offers a name, and the name opens a one-liner.
    for (const district of DISTRICTS) {
      if (!placeDossier(district.key)) continue;
      for (const place of district.locations) {
        expect(placeDossier(place.key), `${place.code} ${place.name}`).toBeDefined();
      }
    }
  });

  it("files every entry under the district it belongs to", () => {
    for (const key of Object.keys(PLACE_DOSSIERS)) {
      if (getDistrict(key)) continue;
      expect(districtOfPlace(key), key).toBeDefined();
    }
  });

  it("is written in paragraphs, not one-liners", () => {
    // These replaced the atlas's single sentences. If an entry is short enough
    // to be one, it was probably pasted in wrong.
    for (const [key, entry] of Object.entries(PLACE_DOSSIERS)) {
      const paragraphs = entry.text.split("\n\n");
      expect(paragraphs.length, `${key} has ${paragraphs.length} paragraph(s)`).toBeGreaterThan(1);
      expect(entry.text.length, key).toBeGreaterThan(600);
      for (const para of paragraphs) {
        expect(para.trim(), `${key} has a blank paragraph`).not.toBe("");
      }
    }
  });

  it("covers every district in the atlas", () => {
    // The whole city is written. A district added later without an entry, or an
    // entry keyed on a name the atlas does not use, shows up here first.
    const unwritten = DISTRICTS.filter((d) => !placeDossier(d.key)).map((d) => d.key);
    expect(unwritten).toEqual([]);
  });

  it("has a picture for every entry", () => {
    // Text and pictures arrive separately, and for a while this held a list of
    // the entries still waiting. Every one of them now has a picture, so the
    // list is empty and stays that way: an entry added later without a picture,
    // or one whose picture is added to the repository but never wired up, shows
    // up here first.
    const pending = Object.entries(PLACE_DOSSIERS)
      .filter(([, entry]) => !entry.image)
      .map(([key]) => key);
    expect(pending).toEqual([]);
  });

  it("keeps the district list it was written against", () => {
    const written = DISTRICTS.filter((d) => placeDossier(d.key)).map((d) => d.key);
    expect(written).toEqual([
      "little_europe",
      "upper_marina",
      "downtown",
      "the_hot_zone",
      "little_china",
      "university_district",
      "the_glen",
      "old_japantown",
      "south_night_city",
      "port_of_night_city",
      "reclamation_zone",
      "old_combat_zone",
      "norcal_military_base",
      "watson_development",
      "kabuki",
      "new_westbrook",
      "charter_hill",
      "exec_zone",
      "heywood_docks",
      "north_heywood",
      "heywood_industrial_zone",
      "santo_domingo",
      "pacifica_playground",
      "rancho_coronado",
    ]);
  });

  it("gives every picture to exactly one place", () => {
    // Two entries sharing a slug means somebody pasted a line and forgot to
    // change it, and the second place quietly wears the first one's face.
    const seen = new Map<string, string>();
    for (const [key, entry] of Object.entries(PLACE_DOSSIERS)) {
      if (!entry.image) continue;
      expect(seen.get(entry.image), `${key} reuses ${entry.image}`).toBeUndefined();
      seen.set(entry.image, key);
    }
  });

  it("closes every emphasis mark it opens", () => {
    // The prose carries **bold** and *italic*, which the dossier renders. An
    // unclosed mark would show the reader a literal asterisk.
    for (const [key, entry] of Object.entries(PLACE_DOSSIERS)) {
      const bare = entry.text.replace(/\*\*[^*]+\*\*/g, "").replace(/\*[^*]+\*/g, "");
      expect(bare.includes("*"), `${key} has an unpaired emphasis mark`).toBe(false);
    }
  });

  it("keeps the prose out of Markdown it cannot render", () => {
    // Only inline emphasis is rendered. A heading, a list or a table pasted in
    // from the source document would reach the reader as raw punctuation.
    for (const [key, entry] of Object.entries(PLACE_DOSSIERS)) {
      for (const para of entry.text.split("\n\n")) {
        expect(para.startsWith("#"), `${key} has a Markdown heading`).toBe(false);
        expect(para.startsWith("|"), `${key} has a Markdown table row`).toBe(false);
        expect(para.includes("<br"), `${key} has an HTML line break`).toBe(false);
      }
    }
  });
});
