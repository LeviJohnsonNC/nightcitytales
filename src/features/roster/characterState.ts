/**
 * Rebuilds a wizard-shaped ChargenState from the saved rows of a FullCharacter.
 * No arithmetic lives here: the engine assembles every number from this state.
 */
import {
  AMMUNITION,
  ARMOR,
  EMPTY_LOADOUT,
  STARTING_LOCATIONS,
  STAT_ORDER,
  WEAPONS,
  getGearPackage,
  isChoice,
  isFashionItem,
  type ArmorLocation,
  type CartLine,
  type CreationMethod,
  type ItemKind,
  type Loadout,
  type PackageEntry,
  type StatBlock,
} from "@/engine";
import { roleAbilityForRole, type ChargenState } from "@/features/chargen/store";
import { STEP_IDS } from "@/features/chargen/steps";
import type { CharacterGear, FullCharacter } from "@/lib/backend";

const ARMOR_LOCATIONS: ArmorLocation[] = ["head", "body", "shield"];

const WEAPON_IDS = new Set(WEAPONS.map((w) => w.id));
const ARMOR_IDS = new Set(ARMOR.map((a) => a.id));
const AMMO_IDS = new Set(AMMUNITION.map((a) => a.id));

function gearKind(itemId: string): ItemKind {
  if (WEAPON_IDS.has(itemId)) return "weapon";
  if (ARMOR_IDS.has(itemId)) return "armor";
  if (AMMO_IDS.has(itemId)) return "ammunition";
  return "fashion";
}

function isPackageRow(row: CharacterGear): boolean {
  return (row.slot ?? "").startsWith("package:");
}

/** Recovers which side of each either/or package choice was saved. */
function packageChoices(
  roleId: string | null,
  method: CreationMethod | null,
  gear: CharacterGear[],
  cyberwareIds: string[],
): Record<string, string> {
  if (!roleId || !method || method === "complete_package") return {};
  const pkg = getGearPackage(roleId);
  const picked: Record<string, string> = {};
  const fields = ["weaponsArmor", "gear", "cyberware"] as const;
  for (const field of fields) {
    const saved =
      field === "cyberware"
        ? cyberwareIds
        : gear.filter((g) => g.slot === `package:${field}`).map((g) => g.item_id);
    (pkg[field] as PackageEntry[]).forEach((entry, index) => {
      if (!isChoice(entry)) return;
      const hit = entry.choice.find((option) => saved.includes(option));
      if (hit) picked[`${field}.${index}`] = hit;
    });
  }
  return picked;
}

function loadoutFrom(full: FullCharacter, method: CreationMethod | null): Loadout {
  const bought = full.gear.filter((row) => !isPackageRow(row));
  const installed = full.cyberware.filter((row) => row.install_location !== null);

  const lines: CartLine[] = [
    ...bought.map((row) => {
      const kind = gearKind(row.item_id);
      const location = ARMOR_LOCATIONS.find((l) => l === row.slot) ?? null;
      return {
        lineId: row.id,
        kind,
        itemId: row.item_id,
        qty: row.quantity,
        budget:
          method === "complete_package"
            ? isFashionItem(kind, row.item_id)
              ? ("fashion" as const)
              : ("gear" as const)
            : ("free" as const),
        location,
        currentSp: row.current_sp,
      };
    }),
    ...installed.map((row) => ({
      lineId: row.id,
      kind: "cyberware" as const,
      itemId: row.item_id,
      qty: 1,
      budget:
        method === "complete_package"
          ? isFashionItem("cyberware", row.item_id)
            ? ("fashion" as const)
            : ("gear" as const)
          : ("free" as const),
      foundationLineId: row.foundational_for,
    })),
  ];

  return {
    packageChoices: packageChoices(
      full.character.role,
      method,
      full.gear,
      full.cyberware.filter((row) => row.install_location === null).map((row) => row.item_id),
    ),
    lines,
  };
}

function statsFrom(full: FullCharacter): Partial<StatBlock> {
  const row = full.stats;
  if (!row) return {};
  const stats: Partial<StatBlock> = {};
  for (const stat of STAT_ORDER) {
    // EMP is stored twice: emp is the cyberware-reduced current, emp_max the STAT.
    const value = stat === "emp" ? (row.emp_max ?? row.emp) : (row as Record<string, unknown>)[stat];
    if (typeof value === "number") stats[stat] = value;
  }
  return stats;
}

function abilityFor(roleId: string): NonNullable<ChargenState["roleAbility"]> {
  const ability = roleAbilityForRole(roleId);
  if (!ability) throw new Error(`Role "${roleId}" has no Role Ability (src/data/rules/roles.json)`);
  return ability;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** The saved character, expressed in the shape the sheet and the wizard read. */
export function stateFromCharacter(full: FullCharacter): ChargenState {
  const method = full.character.creation_method as CreationMethod;
  const roleId = full.character.role;
  const housing = full.finance?.housing ?? "";

  return {
    draftId: null,
    step: "review",
    method,
    roleId,
    roleAbility: full.roleAbility
      ? {
          id: full.roleAbility.ability_id,
          name:
            (record(full.roleAbility.metadata)["name"] as string | undefined) ??
            abilityFor(roleId).name,
          rank: full.roleAbility.rank,
        }
      : abilityFor(roleId),
    name: full.character.name,
    handle: full.character.handle ?? "",
    pronouns: "",
    selfDescription: "",
    portrait: full.character.portrait_id,
    stats: statsFrom(full),
    statRolls: { row: null, rows: {} },
    skills: full.skills.map((row) => ({
      skillId: row.skill_id,
      level: row.level,
      specialization: row.specialization,
    })),
    lifepath: {
      general: record(full.lifepath?.general),
      roleSpecific: record(full.lifepath?.role_specific),
    },
    loadout: full.gear.length || full.cyberware.length ? loadoutFrom(full, method) : EMPTY_LOADOUT,
    lifestyle: { location: STARTING_LOCATIONS.find((l) => housing.includes(l)) ?? null },
    visited: [...STEP_IDS],
    rollLog: [],
  };
}

/** The same character as a fresh, editable draft. */
export function draftStateFromCharacter(full: FullCharacter, name?: string): ChargenState {
  const state = stateFromCharacter(full);
  return { ...state, name: name ?? state.name, step: "review" };
}
