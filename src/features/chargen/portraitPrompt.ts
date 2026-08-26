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
  wornArmor,
  type CartLine,
} from "@/engine";
import { displayValue, readGeneralLifepath } from "./lifepathState";
import { readRoleLifepath } from "./roleLifepathState";
import { genderFromPronouns, type GenderRead } from "./selfDescription";
import { stepsFor } from "./steps";
import { validateStep } from "./validation";
import type { ChargenState } from "./store";

export const MAX_PORTRAIT_TAKES = 4;
export const MAX_PORTRAIT_GENERATIONS = 6;

export type PortraitFacts = {
  handle: string;
  pronouns: string;
  gender: GenderRead;
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
    selfDescription: state.selfDescription.trim(),
  };
}

const HOUSE_LOOK = [
  "Painterly cyberpunk character portrait, rendered as digital oil painting with visible brush texture and matte-painting finish, not photorealism, not 3D render, not anime cel shading.",
  "Single subject, waist-up, facing the camera, 3:4 portrait framing with the head and shoulders filling the frame.",
  "Neon-noir palette: deep navy and cobalt shadow, electric cyan, violet, magenta and hot pink light, with one warm sunset-orange or rose accent.",
  "Cinematic lighting: strong coloured rim light along the jaw and shoulders, soft neon bloom, screen and signage glow, deep shadow, wet chrome and reflective metal catching coloured light.",
  "Shallow, hazy megacity backdrop directly behind the shoulders — a few illuminated windows and restrained signage dissolving fast into volumetric haze and fog. The city is atmosphere, never the subject.",
  "Grounded and lived-in: aging metal, patched infrastructure, grime, worn synthetic fabrics, believable urban wear. Retrofitted onto an old city, not freshly manufactured, not glossy utopian sci-fi.",
  "Spirit of late-1980s and 1990s cyberpunk atmosphere and Blade Runner neon noir, painted as high-end cinematic concept art.",
  "No text, no logos, no watermarks, no captions, no second person, no collage, no weapons aimed at the camera, no wide establishing shot.",
].join(" ");

/** The exact prompt sent to the image model. */
export function buildPortraitPrompt(facts: PortraitFacts): string {
  const lines: string[] = [HOUSE_LOOK, ""];
  lines.push("Subject:");
  if (facts.role) lines.push(`- Occupation on The Street: ${facts.role}`);
  if (facts.roleAbility) lines.push(`- Known for: ${facts.roleAbility}`);
  lines.push(`- Presents as: ${genderPhrase(facts.gender)} (pronouns ${facts.pronouns || "n/a"})`);
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
  if (facts.home) lines.push(`- Lives: ${facts.home} — let it show in the wear, not the backdrop`);
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

/**
 * Everything still missing before a portrait can be generated: the identity
 * fields, plus every earlier required step of the wizard passing its own
 * validation. Self-description stays optional.
 */
export function portraitMissing(state: ChargenState): string[] {
  const missing: string[] = [];
  if (!state.name.trim()) missing.push("name");
  if (!state.handle.trim()) missing.push("handle");
  if (!state.pronouns.trim()) missing.push("pronouns");

  const ids = stepsFor(state.method);
  for (const step of ids) {
    if (step.id === "identity" || step.id === "review") continue;
    // Only actual rule violations block a portrait. Steps where buying
    // nothing is legal (Gear & Armor, Cyberware) must not gate on "untouched".
    const { violations } = validateStep(step.id, state);
    if (violations.length > 0) missing.push(step.title);
  }
  return [...new Set(missing)];
}
