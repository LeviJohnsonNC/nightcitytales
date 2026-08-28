/**
 * NPC DIRECTORY — the faces of Night City.
 *
 * One entry per person, crew or archetype we have artwork for. `image` points at
 * a file in public/images/cast. `bio` is the background text shown in the
 * dossier modal; it is written by hand and stays null until it lands, in which
 * case the modal shows the portrait alone rather than inventing anything.
 *
 * Presentation data only — nothing here is rules data and nothing here is
 * imported by the engine.
 */

import { CAST_BIOS } from "./castBios";
import { WORLD_BIOS } from "./worldBios";

export type NpcKind = "cast" | "broker" | "patron" | "target" | "faction" | "threat";

export interface NpcEntry {
  /** Slug, and the file name under public/images/cast. */
  id: string;
  /** Canonical display name, exactly as written in the content files. */
  name: string;
  /** Extra spellings the prose may use (nickname alone, no-nickname form, plurals). */
  aliases: string[];
  kind: NpcKind;
  /** One line of context shown under the name in the dossier. */
  role: string;
  /** Long-form background. Null until written. */
  bio: string | null;
}

function entry(
  id: string,
  name: string,
  kind: NpcKind,
  role: string,
  aliases: string[] = [],
): NpcEntry {
  return { id, name, kind, role, aliases, bio: CAST_BIOS[id] ?? WORLD_BIOS[id] ?? null };
}

export const NPC_DIRECTORY: NpcEntry[] = [
  // ── Standing cast · fixers ────────────────────────────────────────────────
  entry("ilsa-braun", "Ilsa Bräun", "cast", "Fixer", ["Ilsa Braun", "Ilsa"]),
  entry("marcus-tally-oyelaran", 'Marcus "Tally" Oyelaran', "cast", "Fixer", [
    "Marcus Oyelaran",
    "Tally",
  ]),
  entry("dinh-bao-tran", "Dinh Bao Tran", "cast", "Fixer"),
  entry("rosalind-achebe", "Rosalind Achebe", "cast", "Fixer"),
  entry("yuri-pastrana", "Yuri Pastrana", "cast", "Fixer"),
  entry("kit-mwangi", "Kit Mwangi", "cast", "Fixer"),

  // ── Standing cast · ripperdocs ────────────────────────────────────────────
  entry("dr-ana-srenson", "Dr. Ana Sørenson", "cast", "Ripperdoc", [
    "Ana Sørenson",
    "Dr. Ana Sorenson",
    "Ana Sorenson",
  ]),
  entry("boro-two-thumbs-kalinic", 'Boro "Two-Thumbs" Kalinić', "cast", "Ripperdoc", [
    "Boro Kalinić",
    "Boro Kalinic",
    "Two-Thumbs",
  ]),
  entry("meiling-zhou", "Meiling Zhou", "cast", "Ripperdoc"),
  entry("reg-amankwah", "Reg Amankwah", "cast", "Ripperdoc"),
  entry("dr-halvor-ness", "Dr. Halvor Ness", "cast", "Ripperdoc", ["Halvor Ness"]),
  entry("priya-raghunathan", "Priya Raghunathan", "cast", "Ripperdoc"),

  // ── Standing cast · landlords ─────────────────────────────────────────────
  entry("odalys-kimura", "Odalys Kimura", "cast", "Landlord"),
  entry("bern-halloran", "Bern Halloran", "cast", "Landlord"),
  entry("ma-tsatsu", "Ma Tsatsu", "cast", "Landlord"),
  entry("emeka-duarte", "Emeka Duarte", "cast", "Landlord"),
  entry("verity-nakashima", "Verity Nakashima", "cast", "Landlord"),
  entry("sal-ozturk", "Sal Ozturk", "cast", "Landlord"),

  // ── Standing cast · friends ───────────────────────────────────────────────
  entry("teodora-teo-vasquez", 'Teodora "Teo" Vasquez', "cast", "Friend", [
    "Teodora Vasquez",
    "Teo",
  ]),
  entry("nnamdi-cole", "Nnamdi Cole", "cast", "Friend"),
  entry("sasha-bright-ito", "Sasha Bright-Ito", "cast", "Friend"),
  entry("wren-kovalenko", "Wren Kovalenko", "cast", "Friend"),
  entry("beniamino-benny-sarto", 'Beniamino "Benny" Sarto', "cast", "Friend", [
    "Beniamino Sarto",
    "Benny Sarto",
  ]),
  entry("halima-osei", "Halima Osei", "cast", "Friend"),

  // ── Standing cast · enemies ───────────────────────────────────────────────
  entry("corrado-razor-villanueva", 'Corrado "Razor" Villanueva', "cast", "Enemy", [
    "Corrado Villanueva",
    "Razor",
  ]),
  entry("song-ha-eun", "Song Ha-eun", "cast", "Enemy"),
  entry("deacon-ferris", "Deacon Ferris", "cast", "Enemy"),
  entry("mirela-ionescu", "Mirela Ionescu", "cast", "Enemy"),
  entry("tobias-kanu", "Tobias Kanu", "cast", "Enemy"),
  entry("lark-ferreira", "Lark Ferreira", "cast", "Enemy"),

  // ── Standing cast · old flames ────────────────────────────────────────────
  entry("juno-adeyemi", "Juno Adeyemi", "cast", "Old flame"),
  entry("kasimir-wolde", "Kasimir Wolde", "cast", "Old flame"),
  entry("nadia-sirko", "Nadia Sirko", "cast", "Old flame"),
  entry("emil-onobrakpeya", "Emil Onobrakpeya", "cast", "Old flame"),
  entry("sunny-okafor", "Sunny Okafor", "cast", "Old flame"),
  entry("vero-lindqvist", "Vero Lindqvist", "cast", "Old flame"),

  // ── Job-giving fixers ─────────────────────────────────────────────────────
  entry("rogue-amendiares", "Rogue Amendiares", "broker", "Owner of the Afterlife", ["Rogue"]),
  entry("wakako-okada", "Wakako Okada", "broker", "Westbrook fixer", ["Wakako"]),
  entry("sebastian-padre-ibarra", 'Sebastian "Padre" Ibarra', "broker", "Heywood fixer", [
    "Sebastian Ibarra",
    "Padre",
  ]),
  entry("dakota-smith", "Dakota Smith", "broker", "Badlands routes", ["Dakota"]),
  entry("regina-jones", "Regina Jones", "broker", "Watson fixer", ["Regina"]),
  entry("guadalupe-mama-welles", 'Guadalupe "Mamá" Welles', "broker", "El Coyote Cojo", [
    "Mama Welles",
    "Mamá Welles",
    "Guadalupe Welles",
  ]),

  // ── Patrons and clients ───────────────────────────────────────────────────
  entry("adele-voss", "Adele Voss", "patron", "Arasaka Subcontracts"),
  entry("emil-kovac", "Emil Kovač", "patron", "Kovač Salvage", ["Emil Kovac"]),
  entry("dr-priya-raman", "Dr. Priya Raman", "patron", "Trauma Team billing", ["Priya Raman"]),
  entry("the-quartermaster", "The Quartermaster", "patron", "A Militech cell, voice only", [
    "Quartermaster",
  ]),
  entry("odalys-ferrer", "Odalys Ferrer", "patron", "Night Corp media relations"),
  entry("toshiro-bell", "Toshiro Bell", "patron", "Independent ripperdoc"),

  // ── Named target ──────────────────────────────────────────────────────────
  entry("cira-nwosu", "Cira Nwosu", "target", "A witness who wrote it down"),

  // ── Factions ──────────────────────────────────────────────────────────────
  entry("maelstrom", "Maelstrom", "faction", "Chrome-hungry gang"),
  entry("tyger-claws", "Tyger Claws", "faction", "Westbrook syndicate", [
    "Tyger Claws crew",
    "Tyger Claw",
  ]),
  entry("6th-street", "6th Street", "faction", "Veteran street militia", ["Sixth Street"]),
  entry("corporate-security-officer", "Corporate Security", "faction", "Corpo security detail", [
    "corporate security",
    "corpo security",
  ]),
  entry("militech-contractor", "Militech Contractor", "faction", "Militech contract soldiers", [
    "Militech contractors",
    "Militech contractor",
  ]),

  // ── Hostile archetypes ────────────────────────────────────────────────────
  entry("street-thug", "Street Thug", "threat", "Hostile archetype", ["street thugs"]),
  entry("scavver", "Scavver", "threat", "Hostile archetype", ["scavvers", "scavver crew"]),
  entry("ganger", "Ganger", "threat", "Hostile archetype", ["gangers"]),
  entry("boostergang-chromer", "Boostergang Chromer", "threat", "Hostile archetype", ["chromer"]),
];

const BY_KEY = new Map<string, NpcEntry>();
for (const npc of NPC_DIRECTORY) {
  for (const key of [npc.name, ...npc.aliases]) BY_KEY.set(key.toLowerCase(), npc);
}

/** Every name and alias, longest first, so "Marcus \"Tally\" Oyelaran" wins over "Tally". */
export const NPC_MATCH_KEYS: string[] = [...BY_KEY.keys()].sort((a, b) => b.length - a.length);

export function findNpc(name: string): NpcEntry | null {
  return BY_KEY.get(name.trim().toLowerCase()) ?? null;
}

export function npcImage(npc: NpcEntry): string {
  return `/images/cast/${npc.id}.png`;
}
