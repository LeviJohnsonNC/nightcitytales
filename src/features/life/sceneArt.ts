/**
 * The picture for where the character is standing.
 *
 * Life used to open on a blank column: the first narration sits below the input
 * and the log above it is empty until a turn has run, so the first thing a new
 * campaign shows is several hundred pixels of nothing. The place already has a
 * face — 196 of them live in `public/images/places` and the atlas dossiers
 * point at them — so the opening screen shows it.
 *
 * Resolution walks UP the geography rather than sideways: the venue, then the
 * landmark, then the district. A picture of the wrong bar is a lie; a picture
 * of the right district is merely less specific, and that is the trade this
 * ladder makes. When nothing in the chain has art, `SceneHero` draws a plate
 * from the place's name instead of guessing with someone else's photograph.
 *
 * Pure: the caller passes the stored location key, this returns files and
 * words. No React, no fetching.
 */
import {
  districtOfPlace,
  getDistrict,
  getLandmark,
  getPlace,
  isCombatZone,
  resolvePosition,
} from "@/engine";
import { placeArtwork, placeDossier, type PlaceArtwork } from "@/features/atlas/placeDossiers";

export type SceneArt = {
  /** The picture, at both encoded widths. Absent when nothing in the chain has one. */
  artwork?: PlaceArtwork | undefined;
  /** How close the picture actually is to the character — shown as a caption qualifier. */
  precision: "place" | "district" | "none";
  /** What to call the spot: the venue's name, or the district's. */
  title: string;
  /** The line under it: district, and whether that district is a Combat Zone. */
  subtitle: string;
  /** Alt text, written for someone who cannot see the picture. */
  alt: string;
};

/** The dossier picture for a key, when a dossier exists and has one. */
function artFor(key: string | undefined): PlaceArtwork | undefined {
  if (!key) return undefined;
  const entry = placeDossier(key);
  return entry ? placeArtwork(entry) : undefined;
}

/**
 * What to show for a stored campaign location ("x3", "x3@12,34", a district key).
 *
 * Always returns something — the title and subtitle are useful even when the
 * artwork is missing, because the plate that stands in for a missing picture
 * prints them.
 */
export function sceneArt(locationKey: string | null | undefined): SceneArt {
  const position = resolvePosition(locationKey);
  if (!position) {
    return { precision: "none", title: "Night City", subtitle: "Location unknown", alt: "" };
  }

  const place = position.placeKey ? getPlace(position.placeKey) : undefined;
  const landmark = position.landmarkKey ? getLandmark(position.landmarkKey) : undefined;
  const district = position.placeKey
    ? (districtOfPlace(position.placeKey) ?? getDistrict(position.districtKey))
    : getDistrict(position.districtKey);

  const title = place?.name ?? landmark?.name ?? district?.name ?? "Night City";
  const districtName = district?.name ?? "";
  const zone = district && isCombatZone(district.key) ? " · Combat Zone" : "";
  // Standing in the district itself: naming it twice reads as a bug.
  const subtitle =
    districtName && districtName !== title ? `${districtName}${zone}` : zone.slice(3);

  const exact = artFor(position.placeKey) ?? artFor(position.landmarkKey);
  if (exact) {
    return {
      artwork: exact,
      precision: "place",
      title,
      subtitle,
      alt: `${title}${districtName ? `, ${districtName}` : ""}`,
    };
  }

  const wide = artFor(district?.key);
  if (wide) {
    return {
      artwork: wide,
      precision: "district",
      title,
      subtitle,
      alt: districtName ? `${districtName}, Night City` : "Night City",
    };
  }

  return { precision: "none", title, subtitle, alt: "" };
}
