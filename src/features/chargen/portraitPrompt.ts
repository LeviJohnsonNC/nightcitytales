/**
 * Portrait generation input and prompt.
 *
 * The player never writes the image prompt. It is assembled from what the
 * character already is: Role, pronouns and the gender read from them, the
 * Lifepath glance facts already rolled, and everything they actually bought,
 * wore and installed. One house look constant lives here so every character in
 * the roster comes out of the same art department.
 */
import {
  ageBand,
  getCyberware,
  getFashion,
  getGearPackage,
  getLifepathTable,
  getRoleLifepathOrder,
  getRoleLifepathTable,
  isChoice,
  itemName,
  packageCyberwareIds,
  resolvePackageItem,
  startingLifestylePlan,
  validAge,
  wornArmor,
  type CartLine,
} from "@/engine";
import { displayValue, readGeneralLifepath } from "./lifepathState";
import { readRoleLifepath } from "./roleLifepathState";
import { genderFromPronouns, type GenderRead } from "./selfDescription";
import { stepsFor } from "./steps";
import { validateStep } from "./validation";
import type { ChargenState } from "./store";
import { faceFact } from "./portraitStages";

export const MAX_PORTRAIT_TAKES = 4;
export const MAX_PORTRAIT_GENERATIONS = 6;

/** The size every portrait is generated at. The file's crop is worked out from it. */
export const PORTRAIT_SIZE = { width: 1024, height: 1536 };

export type PortraitFacts = {
  handle: string;
  pronouns: string;
  gender: GenderRead;
  /** Years, so the face is drawn at the age the file says. */
  age: number | null;
  role: string | null;
  roleAbility: string | null;
  facts: { label: string; value: string }[];
  /** Read from BODY. One adjective, never a number. */
  build: string | null;
  /** Fashion bought on the Lifestyle step, plus any package outfit. */
  wardrobe: string[];
  /** Externally visible cyberware only. Internal implants stay invisible. */
  chrome: string[];
  /** Armor actually worn, by location. */
  armor: string[];
  /** One signature weapon, carried and never aimed at the camera. */
  weapon: string | null;
  /** How much of themselves the chrome has cost them, as a look. */
  humanity: string | null;
  /** Where they live, as a wear-and-tear cue. */
  home: string | null;
  /**
   * What makes the backdrop theirs rather than their Role's: the Role
   * Lifepath answers about where they work, the district they live in, the
   * thing they would grab in a fire. Empty until those are answered.
   */
  setting: { label: string; value: string }[];
  selfDescription: string;
};

/** Lifepath tables that describe how someone looks, not what they have done. */
const LOOK_TABLES = [
  "personality",
  "clothing_style",
  "hairstyle",
  "affectation",
  "cultural_origin",
];

/**
 * The Role Lifepath answers that say WHERE this person works — a Netrunner's
 * workspace, a Solo's territory, an Exec's corp and division — read into the
 * backdrop so two characters of the same Role are not painted in the same room.
 * Ids from lifepath-roles.json; a table the Role does not have is skipped.
 */
const SETTING_TABLES: Record<string, string[]> = {
  rockerboy: ["where_do_you_perform", "are_you_in_a_group_or_a_solo_act"],
  solo: ["what_s_your_operational_territory", "what_kind_of_solo_are_you"],
  netrunner: ["what_s_your_workspace_like", "what_kind_of_runner_are_you"],
  tech: ["what_s_your_workspace_like", "what_kind_of_tech_are_you"],
  medtech: ["what_s_your_workspace_like", "what_kind_of_medtech_are_you"],
  media: ["how_does_your_work_reach_the_public", "what_types_of_stories_do_you_want_to_tell"],
  exec: ["what_kind_of_corp_do_you_work_for", "what_division_do_you_work_in"],
  lawman: ["what_is_your_position_on_the_force", "who_is_your_group_s_major_target"],
  fixer: ["what_s_your_office_like", "what_kind_of_fixer_are_you"],
  nomad: [
    "is_your_pack_based_on_land_air_or_sea",
    "if_on_land_what_do_they_do",
    "if_in_air_what_do_they_do",
    "if_at_sea_what_do_they_do",
  ],
};

/** Cyberware categories a stranger on the street could actually see. */
const VISIBLE_CYBERWARE = new Set([
  "cyberlimbs",
  "cyberoptics",
  "cyberaudio",
  "fashionware",
  "external",
  "borgware",
  "neuralware",
]);

function safe<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}

function buildFromBody(body: number | undefined): string | null {
  if (typeof body !== "number") return null;
  if (body <= 3) return "slight, wiry frame";
  if (body <= 6) return "average, workaday frame";
  if (body <= 8) return "broad and powerfully built";
  return "huge, slab-shouldered frame";
}

function humanityRead(loss: number): string | null {
  if (loss <= 0) return null;
  if (loss <= 10) return "lightly chromed; still warm-eyed and clearly human";
  if (loss <= 25) return "visibly chromed; the expression has cooled";
  return "heavily chromed; cold, hard-eyed, more machine than most people are comfortable with";
}

/** Every cyberware line installed, bought or granted by the Role package. */
function cyberwareIds(state: ChargenState): string[] {
  const bought = state.loadout.lines.filter((l) => l.kind === "cyberware").map((l) => l.itemId);
  const fromPackage =
    safe(() =>
      state.roleId && state.method
        ? packageCyberwareIds(state.roleId, state.method, state.loadout.packageChoices)
        : [],
    ) ?? [];
  return [...new Set([...bought, ...fromPackage])];
}

/** Package labels, with each either/or choice point resolved to the pick. */
function packageLabels(state: ChargenState, field: "weaponsArmor" | "gear"): string[] {
  if (!state.roleId || !state.method || state.method === "complete_package") return [];
  const pkg = safe(() => getGearPackage(state.roleId!));
  if (!pkg) return [];
  const out: string[] = [];
  pkg[field].forEach((entry, index) => {
    if (isChoice(entry)) {
      const picked = state.loadout.packageChoices[`${field}.${index}`];
      if (picked) out.push(picked);
    } else {
      out.push(entry.item);
    }
  });
  return out;
}

function weaponLabel(line: CartLine): string {
  return line.variant?.trim() || (safe(() => itemName("weapon", line.itemId)) ?? line.itemId);
}

export function buildPortraitFacts(state: ChargenState, roleName?: string): PortraitFacts {
  const general = readGeneralLifepath(state.lifepath.general);
  const facts: { label: string; value: string }[] = [];
  for (const id of LOOK_TABLES) {
    const entry = general.entries[id];
    const label = safe(() => getLifepathTable(id).label);
    if (entry && label) facts.push({ label, value: displayValue(entry) });
  }

  // The Role's own "what kind of X are you" answer: the one Role Lifepath
  // table that reads on a person rather than in a backstory.
  if (state.roleId) {
    const role = readRoleLifepath(state.lifepath.roleSpecific, state.roleId);
    const firstId = safe(() => getRoleLifepathOrder(state.roleId!)[0]);
    const entry = firstId ? role.entries[firstId] : undefined;
    const label = firstId ? safe(() => getRoleLifepathTable(state.roleId!, firstId).label) : null;
    if (entry && label) facts.push({ label, value: displayValue(entry) });
  }

  // Where they are painted: their own answers about where they work, the
  // district they live in, and the one thing they would never leave behind.
  const setting: { label: string; value: string }[] = [];
  if (state.roleId) {
    const role = readRoleLifepath(state.lifepath.roleSpecific, state.roleId);
    for (const id of SETTING_TABLES[state.roleId] ?? []) {
      const entry = role.entries[id];
      const label = safe(() => getRoleLifepathTable(state.roleId!, id).label);
      if (entry && label) setting.push({ label, value: displayValue(entry) });
    }
  }
  if (state.lifestyle.location) {
    setting.push({ label: "Their part of Night City", value: state.lifestyle.location });
  }
  const keepsake = general.entries["most_valued_possession"];
  if (keepsake) {
    setting.push({ label: "Somewhere in the scene", value: displayValue(keepsake) });
  }

  // The same face at every stage of the picture, and after every reload.
  const face = faceFact(state.castPlan?.seed);
  if (face) facts.push(face);

  // Wardrobe: what they paid for beats what they rolled, and both are shown.
  const wardrobe = state.loadout.lines
    .filter((l) => l.kind === "fashion")
    .map((l) => safe(() => getFashion(l.itemId).name))
    .filter((n): n is string => Boolean(n));
  const outfit = state.roleId &&
    state.method &&
    state.method !== "complete_package" && [
      ...(safe(() => getGearPackage(state.roleId!).outfit) ?? []),
    ];
  if (outfit) wardrobe.push(...outfit);

  // Chrome: only the pieces someone could see.
  const chrome = cyberwareIds(state)
    .map((id) => safe(() => getCyberware(id)))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c) => VISIBLE_CYBERWARE.has(c.category))
    .map((c) => c.name);

  const humanityLoss = cyberwareIds(state).reduce(
    (sum, id) => sum + (safe(() => getCyberware(id).humanityLoss) ?? 0),
    0,
  );

  // Armor: bought and worn first, then whatever the package handed them.
  const worn = wornArmor(state.loadout);
  const armor = Object.entries(worn)
    .map(([location, line]) => {
      const name = safe(() => itemName("armor", line.itemId));
      return name ? `${name} worn on the ${location}` : null;
    })
    .filter((a): a is string => Boolean(a));
  const packageGear = packageLabels(state, "weaponsArmor");
  for (const label of packageGear) {
    if (safe(() => resolvePackageItem(label))?.kind === "armor") armor.push(label);
  }

  // One signature weapon, bought if they bought one, otherwise from the package.
  const boughtWeapon = state.loadout.lines.find((l) => l.kind === "weapon");
  const packageWeapon = packageGear.find(
    (label) => safe(() => resolvePackageItem(label))?.kind === "weapon",
  );
  const weapon = boughtWeapon ? weaponLabel(boughtWeapon) : (packageWeapon ?? null);

  const plan = safe(() => startingLifestylePlan(state.roleId));
  const location = state.lifestyle.location;
  const home = plan
    ? `${plan.housingName}${location ? ` in ${location}` : ""}, ${plan.lifestyleName} lifestyle`
    : null;

  return {
    handle: state.handle.trim(),
    pronouns: state.pronouns.trim(),
    gender: genderFromPronouns(state.pronouns),
    age: validAge(state.age),
    role: roleName ?? null,
    roleAbility: state.roleAbility?.name ?? null,
    facts,
    build: buildFromBody(state.stats.body),
    wardrobe: [...new Set(wardrobe)],
    chrome: [...new Set(chrome)],
    armor: [...new Set(armor)],
    weapon,
    humanity: humanityRead(humanityLoss),
    home,
    setting,
    selfDescription: state.selfDescription.trim(),
  };
}

const HOUSE_LOOK = [
  "Painterly cyberpunk character portrait, rendered as digital oil painting with visible brush texture and matte-painting finish, not photorealism, not 3D render, not anime cel shading.",
  "Single subject, chest-up, facing the camera, in a tall 2:3 frame. It will be cropped to a square of the top two-thirds, so compose for that: the eyes sit on the upper-third line, there is a hand's width of clear headroom above the hair, and the shoulders and collar are fully in frame by the two-thirds line. Nothing important below it.",
  "Neon-noir palette keyed to the setting: deep shadow with the light sources the place actually has — a surgical lamp, a forge, stage lights, headlights, a boardroom's cold glass — rather than the same blue and magenta every time.",
  "Cinematic lighting: strong coloured rim light along the jaw and shoulders, soft bloom from the setting's own lights, deep shadow, worn metal catching the light.",
  "The backdrop is the place this person belongs, and it must be recognisable: real, specific objects and light sources behind the shoulders, in soft focus but legible at a glance, so the picture says who they are. Never a generic blurred skyline or empty neon bokeh.",
  "Grounded and lived-in: aging metal, patched infrastructure, grime, worn synthetic fabrics, believable urban wear. Retrofitted onto an old city, not freshly manufactured, not glossy utopian sci-fi.",
  "Spirit of late-1980s and 1990s cyberpunk atmosphere and Blade Runner neon noir, painted as high-end cinematic concept art.",
  "No text, no logos, no watermarks, no captions, no second person, no collage, no weapons aimed at the camera, no wide establishing shot.",
].join(" ");

/**
 * Where each Role is painted standing. The backdrop is the one place the
 * portrait can say what the character DOES, so every Role gets a setting of
 * its own instead of the generic megacity haze. Keyed by the Role's display
 * name from roles.json; an unknown Role falls back to the city.
 */
const ROLE_BACKDROPS: Record<string, string> = {
  Rockerboy:
    "a stage moments before the set — microphone stand and amp stacks in shadow, a roaring crowd reduced to silhouettes and raised hands, harsh stage lighting and laser haze cutting through smoke",
  Solo: "a rain-slicked combat zone rooftop or checkpoint at night — muzzle-flash-orange emergency lights, spent casings, armored barriers and a burning barrel, the city held at gunpoint's distance",
  Netrunner:
    "a darkened server den — a nest of cables and coolant lines, stacked monitors and holo-displays throwing ghostly interface light across the gloom, a netrunner's chair and cyberdeck cables behind them",
  Tech: "a cluttered workshop bench — tool racks, half-disassembled tech, a welding torch's blue spark, parts bins and dangling work lights in oily shadow",
  Medtech:
    "a back-alley ripperdoc clinic — a surgical lamp's cold cone of light, a trauma kit and chrome instruments on a steel tray, medical monitors glowing softly behind a stained privacy curtain",
  Media:
    "a live news scene at night — camera rig and recording drone lights, a reporter's datapad glow, police barriers and distant sirens smeared into red-and-blue haze",
  Exec: "a corporate tower high above the city — floor-to-ceiling glass, a boardroom table's polished reflection, cold recessed lighting and the megacity spread out far below like a possession",
  Lawman:
    "a cordoned crime scene under NCPD lights — flickering police barricades, evidence markers, rain-slick asphalt catching red and blue flashers, a patrol vehicle looming in the dark",
  Fixer:
    "the back booth of a neon-lit night market bar — a deal half-made on the table, bottle glass and credstick glinting, hangers-on and goods crates blurred into warm smoky depth",
  Nomad:
    "the open road at the city's edge — a dusty caravan of patched vehicles and bikes, headlights and a campfire burning low, the badland horizon swallowing the last of the light",
};

const DEFAULT_BACKDROP =
  "a hazy megacity street — a few illuminated windows and restrained signage dissolving into fog";

/** The exact prompt sent to the image model. */
export function buildPortraitPrompt(facts: PortraitFacts): string {
  const lines: string[] = [HOUSE_LOOK, ""];
  const backdrop = (facts.role && ROLE_BACKDROPS[facts.role]) || DEFAULT_BACKDROP;
  lines.push(
    `Backdrop: ${backdrop}. Soft focus behind the subject, but the props and light sources stay recognisable.`,
  );
  if (facts.setting.length) {
    lines.push("Make the backdrop specifically theirs, from their own file:");
    for (const s of facts.setting) lines.push(`- ${s.label}: ${s.value}`);
  }
  lines.push("");
  lines.push("Subject:");
  if (facts.role) lines.push(`- Occupation on The Street: ${facts.role}`);
  if (facts.roleAbility) lines.push(`- Known for: ${facts.roleAbility}`);
  lines.push(`- Presents as: ${genderPhrase(facts.gender)} (pronouns ${facts.pronouns || "n/a"})`);
  if (facts.age !== null) {
    lines.push(
      `- Age: ${facts.age} (${ageBand(facts.age).label}) — let the face, skin and hair show exactly that age`,
    );
  }
  if (facts.build) lines.push(`- Build: ${facts.build}`);
  for (const f of facts.facts) lines.push(`- ${f.label}: ${f.value}`);
  if (facts.wardrobe.length) lines.push(`- Wearing: ${facts.wardrobe.join("; ")}`);
  if (facts.armor.length) lines.push(`- Armor: ${facts.armor.join("; ")}`);
  if (facts.chrome.length) {
    lines.push(`- Visible cybernetics, and only these: ${facts.chrome.join("; ")}`);
  }
  if (facts.humanity) lines.push(`- Chrome has cost them: ${facts.humanity}`);
  if (facts.weapon) {
    lines.push(`- Carries a ${facts.weapon}, holstered or slung, never pointed at the camera`);
  }
  if (facts.home) lines.push(`- Lives: ${facts.home} — let it show in the wear`);
  if (facts.selfDescription) lines.push(`- Reads at a glance as: ${facts.selfDescription}`);
  lines.push("");
  lines.push(
    "Render exactly the person described. Do not add gear, tattoos, or cybernetics that were not described.",
  );
  return lines.join("\n");
}

function genderPhrase(gender: GenderRead): string {
  switch (gender) {
    case "female":
      return "a woman";
    case "male":
      return "a man";
    case "non-binary":
      return "androgynous, non-binary presentation";
    default:
      return "gender unspecified, ambiguous presentation";
  }
}
