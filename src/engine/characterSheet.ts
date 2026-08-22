/**
 * Assembles a complete, display-ready character sheet from a plain build
 * object. Pure: no React, no backend, no feature imports. Every number here
 * comes from another engine function or straight out of the rules data.
 */
import {
  getAmmunition,
  getArmor,
  getCyberware,
  getFashion,
  getWeapon,
  type ArmorLocation,
  type CatalogArmor,
  type CatalogCyberware,
} from "./catalog";
import { deriveStats } from "./derived";
import { derivedStatColumns, type DerivedStatColumns } from "./derivedColumns";
import { getGearPackage, isChoice, type PackageEntry } from "./gearPackages";
import type { HumanityLossResult } from "./humanity";
import { startingLifestylePlan, type StartingLifestylePlan } from "./lifestyle";
import {
  eurobucksKept,
  foundations,
  lineCost,
  loadoutHumanity,
  wornArmor,
  type CartLine,
  type Loadout,
} from "./loadout";
import { getSkill, STAT_ORDER, type SkillDefinition } from "./rulesData";
import { skillBase, skillEntryName, type SkillEntry } from "./skillAllocation";
import type { CreationMethod, DerivedStats, StatBlock, StatKey } from "./types";

export type CharacterBuild = {
  method: CreationMethod | null;
  roleId: string | null;
  roleAbility: { id: string; name: string; rank: number } | null;
  name: string;
  handle: string;
  pronouns: string;
  selfDescription: string;
  portraitId: string | null;
  stats: Partial<StatBlock>;
  skills: SkillEntry[];
  loadout: Loadout;
  lifestyleLocation: string | null;
};

export type SheetSkillLine = {
  key: string;
  skillId: string;
  name: string;
  category: string;
  stat: StatKey;
  statValue: number | null;
  level: number;
  /** STAT + Skill Level. Null until the STAT exists. */
  base: number | null;
  doubleCost: boolean;
  granted: boolean;
};

export type SheetWeaponLine = {
  lineId: string;
  itemId: string;
  name: string;
  skill: string;
  damage: string;
  magazine: number | null;
  rof: number;
  handsRequired: string;
  qty: number;
  notes: string | null;
};

export type SheetArmorLine = {
  lineId: string;
  location: ArmorLocation;
  itemId: string;
  name: string;
  sp: number | null;
  currentSp: number | null;
  penalty: CatalogArmor["penalty"];
  notes: string | null;
};

export type SheetSimpleLine = {
  lineId: string;
  itemId: string;
  name: string;
  qty: number;
  cost: number;
  notes?: string | null;
};

export type SheetCyberwareOption = {
  lineId: string;
  item: CatalogCyberware;
};

export type SheetCyberwareInstall = {
  lineId: string;
  item: CatalogCyberware;
  /** Foundations only. */
  slots: number | null;
  slotsUsed: number | null;
  options: SheetCyberwareOption[];
};

export type SheetCyberwareLocation = {
  install: string;
  installs: SheetCyberwareInstall[];
  humanityLoss: number;
};

export type SheetFinance = {
  eurobucks: number;
  plan: StartingLifestylePlan;
  location: string | null;
  housing: string;
  lifestyle: string;
  rent: number;
  lifestyleCost: number;
};

export type SheetPackageChoiceLine = { id: string; options: string[]; picked: string | null };

export type AssembledCharacter = {
  statsComplete: boolean;
  stats: Partial<StatBlock>;
  statOrder: StatKey[];
  derived: DerivedStats | null;
  derivedColumns: DerivedStatColumns | null;
  humanity: HumanityLossResult | null;
  /** EMP after cyberware, alongside the STAT-block maximum. */
  empCurrent: number | null;
  skills: SheetSkillLine[];
  skillsByCategory: { category: string; lines: SheetSkillLine[] }[];
  weapons: SheetWeaponLine[];
  armor: SheetArmorLine[];
  ammunition: SheetSimpleLine[];
  fashion: SheetSimpleLine[];
  cyberware: SheetCyberwareLocation[];
  /** Fixed-package lines, verbatim from gear-packages.json. */
  packageWeaponsArmor: PackageEntry[];
  packageGear: PackageEntry[];
  packageCyberware: PackageEntry[];
  packageOutfit: string[];
  packageChoices: SheetPackageChoiceLine[];
  /** Specific weapon picked for a package entry, keyed by "<field>.<index>". */
  packageVariants: Record<string, string>;
  finance: SheetFinance;
};

function statValue(stats: Partial<StatBlock>, stat: StatKey): number | null {
  const value = stats[stat];
  return typeof value === "number" ? value : null;
}

function skillStat(skill: SkillDefinition): StatKey {
  const stat = skill.stat as StatKey;
  if (!STAT_ORDER.includes(stat)) {
    throw new Error(
      `Skill "${skill.id}" has stat "${skill.stat}", which is not a STAT (src/data/rules/skills.json)`,
    );
  }
  return stat;
}

export function sheetSkillLines(
  entries: SkillEntry[],
  stats: Partial<StatBlock>,
): SheetSkillLine[] {
  return entries
    .map((entry) => {
      const skill = getSkill(entry.skillId);
      const stat = skillStat(skill);
      const value = statValue(stats, stat);
      return {
        key: entry.specialization ? `${entry.skillId}::${entry.specialization}` : entry.skillId,
        skillId: entry.skillId,
        name: skillEntryName(entry),
        category: skill.category,
        stat,
        statValue: value,
        level: entry.level,
        base: value === null ? null : skillBase(value, entry.level),
        doubleCost: skill.doubleCost,
        granted: Boolean(entry.granted),
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function group<T>(items: T[], key: (item: T) => string): { category: string; lines: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return [...map.entries()].map(([category, lines]) => ({ category, lines }));
}

function cyberwareByLocation(loadout: Loadout): SheetCyberwareLocation[] {
  const cyber = loadout.lines.filter((l) => l.kind === "cyberware");
  const foundationStates = foundations(loadout);
  const slotted = new Set(cyber.filter((l) => l.foundationLineId).map((l) => l.lineId));

  const installs: SheetCyberwareInstall[] = cyber
    .filter((line) => !slotted.has(line.lineId))
    .map((line) => {
      const item = getCyberware(line.itemId);
      const state = foundationStates.find((f) => f.line.lineId === line.lineId);
      return {
        lineId: line.lineId,
        item,
        slots: state ? state.slots : null,
        slotsUsed: state ? state.used : null,
        options: cyber
          .filter((l) => l.foundationLineId === line.lineId)
          .map((l) => ({ lineId: l.lineId, item: getCyberware(l.itemId) })),
      };
    });

  return group(installs, (i) => i.item.install).map(({ category, lines }) => ({
    install: category,
    installs: lines,
    humanityLoss: lines.reduce(
      (sum, i) =>
        sum + i.item.humanityLoss + i.options.reduce((s, o) => s + o.item.humanityLoss, 0),
      0,
    ),
  }));
}

function packageEntries(roleId: string | null, method: CreationMethod | null) {
  if (!roleId || !method || method === "complete_package") {
    return { weaponsArmor: [], gear: [], cyberware: [], outfit: [] };
  }
  const pkg = getGearPackage(roleId);
  return {
    weaponsArmor: pkg.weaponsArmor,
    gear: pkg.gear,
    cyberware: pkg.cyberware,
    outfit: pkg.outfit,
  };
}

function choiceLines(
  roleId: string | null,
  method: CreationMethod | null,
  loadout: Loadout,
): SheetPackageChoiceLine[] {
  if (!roleId || !method || method === "complete_package") return [];
  const fields: ("weaponsArmor" | "gear" | "cyberware")[] = ["weaponsArmor", "gear", "cyberware"];
  const pkg = getGearPackage(roleId);
  const out: SheetPackageChoiceLine[] = [];
  for (const field of fields) {
    pkg[field].forEach((entry: PackageEntry, index: number) => {
      if (!isChoice(entry)) return;
      const id = `${field}.${index}`;
      out.push({ id, options: entry.choice, picked: loadout.packageChoices[id] ?? null });
    });
  }
  return out;
}

function simpleLines(
  lines: CartLine[],
  resolve: (itemId: string) => { name: string; notes?: string | null },
): SheetSimpleLine[] {
  return lines.map((line) => {
    const item = resolve(line.itemId);
    return {
      lineId: line.lineId,
      itemId: line.itemId,
      name: item.name,
      qty: line.qty,
      cost: lineCost(line),
      notes: item.notes ?? null,
    };
  });
}

export function assembleCharacter(build: CharacterBuild): AssembledCharacter {
  const statsComplete = STAT_ORDER.every((stat) => typeof build.stats[stat] === "number");
  const derived = statsComplete ? deriveStats(build.stats as StatBlock) : null;
  const columns = statsComplete ? derivedStatColumns(build.stats as StatBlock) : null;
  const humanity = derived ? loadoutHumanity(derived.humanityMax, build.loadout) : null;

  const skills = sheetSkillLines(build.skills, build.stats);
  const worn = wornArmor(build.loadout);
  const pkg = packageEntries(build.roleId, build.method);
  const plan = startingLifestylePlan(build.roleId);

  return {
    statsComplete,
    stats: build.stats,
    statOrder: STAT_ORDER,
    derived,
    derivedColumns: columns,
    humanity,
    empCurrent: humanity ? humanity.emp : statValue(build.stats, "emp"),
    skills,
    skillsByCategory: group(skills, (s) => s.category).sort((a, b) =>
      a.category.localeCompare(b.category),
    ),
    weapons: build.loadout.lines
      .filter((l) => l.kind === "weapon")
      .map((line) => {
        const w = getWeapon(line.itemId);
        return {
          lineId: line.lineId,
          itemId: w.id,
          name: w.name,
          skill: w.skill,
          damage: w.damage,
          magazine: w.magazine,
          rof: w.rof,
          handsRequired: w.handsRequired,
          qty: line.qty,
          notes: w.notes ?? null,
        };
      }),
    armor: (Object.keys(worn) as ArmorLocation[]).map((location) => {
      const line = worn[location]!;
      const a = getArmor(line.itemId);
      return {
        lineId: line.lineId,
        location,
        itemId: a.id,
        name: a.name,
        sp: a.sp,
        currentSp: line.currentSp ?? a.sp,
        penalty: a.penalty,
        notes: a.notes ?? null,
      };
    }),
    ammunition: simpleLines(
      build.loadout.lines.filter((l) => l.kind === "ammunition"),
      (id) => getAmmunition(id),
    ),
    fashion: simpleLines(
      build.loadout.lines.filter((l) => l.kind === "fashion"),
      (id) => getFashion(id),
    ),
    cyberware: cyberwareByLocation(build.loadout),
    packageWeaponsArmor: pkg.weaponsArmor,
    packageGear: pkg.gear,
    packageCyberware: pkg.cyberware,
    packageOutfit: pkg.outfit,
    packageChoices: choiceLines(build.roleId, build.method, build.loadout),
    packageVariants: build.loadout.packageVariants ?? {},
    finance: {
      eurobucks: build.method ? eurobucksKept(build.method, build.loadout) : 0,
      plan,
      location: plan.requiresLocation ? build.lifestyleLocation : null,
      housing: plan.housingName,
      lifestyle: plan.lifestyleName,
      rent: plan.rent,
      lifestyleCost: plan.lifestyleCost,
    },
  };
}
