/**
 * What the descent is about: the player's own facts, from the sheet.
 *
 * The search narrows the city by where they live, what they do and who they
 * are on sight — every one a fact the character already has, said the way a
 * file would say it. Pure. No numbers go on screen that are the player's: the
 * identity line is the band the narrators get ("woman, mid-thirties"), never
 * the age.
 */
import {
  IDENTITY_KEY,
  areaOf,
  districtOfPlace,
  getDistrict,
  getPlace,
  identityLine,
  readIdentity,
} from "@/engine";
import rolesData from "@/data/rules/roles.json";
import type { OpeningBundle } from "../openingOps";
import { hourWords } from "../openingContext";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

export type DescentFilter = { label: string; value: string };

export type DescentFacts = {
  handle: string | null;
  name: string;
  role: string | null;
  placeKey: string | null;
  placeName: string | null;
  districtKey: string | null;
  districtName: string | null;
  /** Four lines, in the order the search applies them. */
  filters: DescentFilter[];
  /** What the window says while the night is being written. */
  lines: string[];
  portraitPath: string | null;
  /** "late evening", "the small hours": how dark the window is. */
  hour: string;
};

/** What a Role is doing, and thinking about, in a quiet room. Second person, no numbers. */
const ROLE_LINES: Record<string, [string, string]> = {
  Rockerboy: [
    "Your hands still remember the set.",
    "Somebody down the hall is humming your song, wrong.",
  ],
  Solo: ["Counting the exits.", "The same car twice on this street."],
  Netrunner: ["Listening to the building's network.", "The dead spot in the stairwell, as always."],
  Tech: ["Something in the wall hums off-key.", "A fix you meant to finish."],
  Medtech: ["Your hands are clean. They are always clean.", "A kit within reach, restocked twice."],
  Media: [
    "Three open tabs and a story nobody has printed.",
    "The recorder's red light, off. For now.",
  ],
  Exec: ["A message you have not answered, on purpose.", "The city, in glass, below you."],
  Lawman: [
    "A badge in the drawer, a habit on your hip.",
    "The scanner, turned low, still talking.",
  ],
  Fixer: ["Four numbers on the phone that owe you.", "Everybody wants something by morning."],
  Nomad: ["Wind you cannot smell in here.", "The family, a long way off."],
};

const GENERIC_LINES = (place: string | null): string[] => [
  place ? `Reading the street outside ${place}.` : "Reading the street.",
  "Rain on the glass.",
  "The building, settling.",
  "Somebody else's music through the wall.",
  "Waiting for the night to decide.",
];

/** A Role id or its printed name, as its printed name. */
function roleName(role: string | null | undefined): string | null {
  if (!role) return null;
  return ROLE_NAMES[role]?.name ?? role;
}

/** Roles' lines, interleaved with the room's, so the wait never repeats itself soon. */
export function waitingLines(role: string | null, place: string | null): string[] {
  const own = (role && ROLE_LINES[role]) || null;
  const room = GENERIC_LINES(place);
  const out: string[] = [];
  const max = Math.max(own?.length ?? 0, room.length);
  for (let i = 0; i < max; i++) {
    const mine = own?.[i];
    if (mine) out.push(mine);
    const generic = room[i];
    if (generic) out.push(generic);
  }
  return out;
}

export function buildDescentFacts(bundle: OpeningBundle): DescentFacts {
  const { campaign, character } = bundle;
  const homeKey = character.finance?.home_place_key ?? campaign.location_key ?? null;
  const place = homeKey ? getPlace(homeKey) : undefined;
  const district = homeKey ? (districtOfPlace(homeKey) ?? getDistrict(homeKey)) : undefined;
  const area = district ? areaOf(district.key) : undefined;
  const role = roleName(character.character.role);
  const general = (character.lifepath?.general ?? {}) as Record<string, unknown>;
  const who = identityLine(readIdentity(general[IDENTITY_KEY]));

  const filters: DescentFilter[] = [
    { label: "Area", value: area?.name ?? "Night City" },
    { label: "District", value: district?.name ?? "Somewhere in it" },
    { label: "Does", value: role ?? "Whatever pays" },
    { label: "Reads as", value: who ?? "Nobody you would notice" },
  ];

  return {
    handle: character.character.handle?.trim() || null,
    name: character.character.name,
    role,
    placeKey: place?.key ?? null,
    placeName: place?.name ?? null,
    districtKey: district?.key ?? null,
    districtName: district?.name ?? null,
    filters,
    lines: waitingLines(role, place?.name ?? null),
    portraitPath: character.character.portrait_path ?? null,
    hour: hourWords(campaign.minute ?? 0),
  };
}
