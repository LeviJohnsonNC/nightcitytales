/**
 * Turns the finished wizard state into the single payload the backend writes
 * in one transaction. Derived columns come from the engine helper only.
 */
import {
  derivedStatColumns,
  getCyberware,
  isChoice,
  type AssembledCharacter,
  type CharacterBuild,
  type StatBlock,
} from "@/engine";
import { saveCompleteCharacter, type SaveCharacterPayload } from "@/lib/backend";
import type { ChargenState } from "./store";

export function savePayload(
  state: ChargenState,
  build: CharacterBuild,
  sheet: AssembledCharacter,
): SaveCharacterPayload {
  if (!build.roleId || !build.method) throw new Error("Role and method are required to save.");
  if (!sheet.statsComplete) throw new Error("STATs are incomplete.");

  const stats = build.stats as StatBlock;
  const columns = derivedStatColumns(stats);
  const humanityCurrent = sheet.humanity ? sheet.humanity.humanitySheet : columns.humanity_max;
  const empCurrent = sheet.humanity ? sheet.humanity.emp : stats.emp;

  const gear = [
    ...build.loadout.lines
      .filter((line) => line.kind !== "cyberware")
      .map((line) => ({
        item_id: line.itemId,
        quantity: line.qty,
        equipped: line.kind === "armor" ? Boolean(line.location) : false,
        slot: line.location ?? line.kind,
        current_sp: line.currentSp ?? null,
        notes: line.variant ?? null,
      })),
    ...(["weaponsArmor", "gear"] as const).flatMap((field) =>
      (field === "weaponsArmor" ? sheet.packageWeaponsArmor : sheet.packageGear).map(
        (entry, index) => {
          const picked = isChoice(entry)
            ? (build.loadout.packageChoices[`${field}.${index}`] ?? entry.choice[0]!)
            : entry.item;
          const variant = build.loadout.packageVariants?.[`${field}.${index}`];
          return {
            item_id: picked,
            quantity: isChoice(entry) ? 1 : entry.qty,
            equipped: false,
            slot: `package:${field}`,
            current_sp: null,
            notes: (variant ? `Role package · ${variant}` : "Role package") as string | null,
          };
        },
      ),
    ),
    ...sheet.packageOutfit.map((item) => ({
      item_id: item,
      quantity: 1,
      equipped: false,
      slot: "package:outfit",
      current_sp: null,
      notes: "Role package outfit" as string | null,
    })),
  ];

  const cyberware = [
    ...build.loadout.lines
      .filter((line) => line.kind === "cyberware")
      .map((line) => {
        const item = getCyberware(line.itemId);
        return {
          key: line.lineId,
          foundation_key: line.foundationLineId ?? null,
          item_id: line.itemId,
          install_location: item.install,
          humanity_loss_rolled: item.humanityLoss,
        };
      }),
    ...sheet.packageCyberware.map((entry, index) => ({
      key: `package.cyberware.${index}`,
      foundation_key: null,
      item_id: isChoice(entry)
        ? (build.loadout.packageChoices[`cyberware.${index}`] ?? entry.choice[0]!)
        : entry.item,
      install_location: null,
      humanity_loss_rolled: null,
    })),
  ];

  return {
    draft_id: state.draftId,
    character: {
      name: state.name.trim(),
      handle: state.handle.trim() || null,
      role: build.roleId,
      creation_method: build.method,
      portrait_id: build.portraitId,
      portrait_path: build.portraitPath ?? null,
    },
    stats: {
      ...stats,
      ...columns,
      emp: empCurrent,
      emp_max: stats.emp,
      hp_current: columns.hp_max,
      humanity_current: humanityCurrent,
    },
    skills: state.skills.map((entry) => ({
      skill_id: entry.skillId,
      level: entry.level,
      specialization: entry.specialization ?? null,
    })),
    role_ability: build.roleAbility
      ? {
          ability_id: build.roleAbility.id,
          rank: build.roleAbility.rank,
          metadata: { name: build.roleAbility.name },
        }
      : null,
    gear,
    cyberware,
    lifepath: {
      general: state.lifepath.general,
      role_specific: state.lifepath.roleSpecific,
      narrative: state.background.trim() || null,
    },
    finance: {
      eurobucks: sheet.finance.eurobucks,
      lifestyle: sheet.finance.lifestyle,
      housing: sheet.finance.location
        ? `${sheet.finance.housing}, ${sheet.finance.location}`
        : sheet.finance.housing,
      rent: sheet.finance.rent,
    },
  };
}

export async function saveCharacterFromState(
  state: ChargenState,
  build: CharacterBuild,
  sheet: AssembledCharacter,
): Promise<string> {
  return saveCompleteCharacter(savePayload(state, build, sheet));
}
