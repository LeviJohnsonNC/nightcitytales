/**
 * Three ways to be each Role, as a starting point for the Skills step.
 *
 * The step that lost a new player was this one: eighty-six points and twenty
 * unfamiliar Skills with a plus and a minus beside each. A preset asks a better
 * question — "how do you work?" — and answers the arithmetic for them.
 *
 * A preset grants nothing and bends no rule. It names the Skills a way of
 * working leans on (`skill-presets.json`, a house rule only in which three are
 * offered), and `presetEntries` turns that into an ordinary allocation:
 *
 *  - every one of the Role's twenty Skills, at the method's floor or above;
 *  - FOCUS Skills raised to the cap first, then SUPPORT Skills, then the rest
 *    evenly, in the Role's printed order, until the budget is spent EXACTLY —
 *    the validators refuse unspent points as firmly as overspent ones;
 *  - double-cost Skills charged double, like everywhere else.
 *
 * The result goes through the same `validateSkillEntries` as a hand-built
 * sheet, and a test holds every preset of every Role to it under both methods.
 * Pure. Plain objects in, plain objects out.
 */
import data from "@/data/rules/skill-presets.json";
import { findSkillByName, SKILL_PACKAGE_RULES, SKILL_RULES } from "./rulesData";
import {
  rolePackageEntries,
  skillEntryKey,
  skillPointCost,
  type SkillEntry,
} from "./skillAllocation";

export type SkillPreset = {
  id: string;
  name: string;
  /** Second person, one or two sentences: why you would work this way. */
  pitch: string;
  /** Skill names raised to the cap first. */
  focus: string[];
  /** Skill names raised next. */
  support: string[];
};

type PresetFile = { houseRule: boolean; note: string; roles: Record<string, SkillPreset[]> };
const FILE = data as unknown as PresetFile;

export const SKILL_PRESETS_ARE_HOUSE_RULE: boolean = FILE.houseRule;

/** The three ways to be this Role, or none for a Role the file does not cover. */
export function presetsFor(roleId: string | null | undefined): SkillPreset[] {
  return roleId ? (FILE.roles[roleId] ?? []) : [];
}

export function getPreset(roleId: string, presetId: string): SkillPreset | undefined {
  return presetsFor(roleId).find((p) => p.id === presetId);
}

/** Every Role the presets cover. For tests. */
export const PRESET_ROLES: string[] = Object.keys(FILE.roles);

type Method = "edgerunner" | "complete_package";

function rulesFor(method: Method) {
  return method === "edgerunner"
    ? SKILL_PACKAGE_RULES.edgerunner
    : SKILL_PACKAGE_RULES.completePackage;
}

/** The skill id a preset names, or undefined when it names nothing real. */
export function presetSkillId(name: string): string | undefined {
  return findSkillByName(name)?.id;
}

/**
 * The allocation a preset makes for this Role under this method.
 *
 * `current` is the sheet as it stands, read for one thing only: a
 * specialization the player already chose (the instrument they play, the
 * Science they studied, the neighbourhood they are a local of) is kept rather
 * than reset to the printed placeholder.
 */
export function presetEntries(input: {
  method: Method;
  roleId: string;
  preset: SkillPreset;
  current?: SkillEntry[];
}): SkillEntry[] {
  const rules = rulesFor(input.method);
  const floor =
    input.method === "edgerunner"
      ? SKILL_PACKAGE_RULES.edgerunner.minLevel
      : SKILL_RULES.basicSkillMinimum;
  const cap = rules.maxLevel;
  const budget = rules.skillPoints;

  const current = (input.current ?? []).filter((e) => !e.granted);
  const entries: SkillEntry[] = rolePackageEntries(input.roleId).map((entry) => {
    const chosen = current.find((c) => c.skillId === entry.skillId && c.specialization);
    return {
      ...entry,
      specialization: chosen?.specialization ?? entry.specialization,
      level: floor,
    };
  });

  const spent = () => entries.reduce((sum, e) => sum + skillPointCost(e.skillId, 0, e.level), 0);
  const indexOf = (name: string) => {
    const id = presetSkillId(name);
    return id === undefined ? -1 : entries.findIndex((e) => e.skillId === id);
  };
  const raiseTo = (i: number, target: number) => {
    const entry = entries[i];
    if (!entry) return;
    while (entry.level < Math.min(target, cap)) {
      const step = skillPointCost(entry.skillId, entry.level, entry.level + 1);
      if (spent() + step > budget) return;
      entry.level += 1;
    }
  };

  const focus = input.preset.focus.map(indexOf).filter((i) => i >= 0);
  const support = input.preset.support.map(indexOf).filter((i) => i >= 0);
  for (const i of focus) raiseTo(i, cap);
  for (const i of support) raiseTo(i, 4);
  for (const i of support) raiseTo(i, cap);

  // Whatever is left goes round the rest one Level at a time, so nothing the
  // preset did not name is left at the floor while points sit unspent.
  const rest = entries.map((_, i) => i).filter((i) => !focus.includes(i) && !support.includes(i));
  let moved = true;
  while (spent() < budget && moved) {
    moved = false;
    for (const i of [...rest, ...support, ...focus]) {
      if (spent() >= budget) break;
      const before = entries[i]!.level;
      raiseTo(i, before + 1);
      if (entries[i]!.level > before) moved = true;
    }
  }

  // One point left and only double-cost Skills with room: trade a double-cost
  // Level for two ordinary ones, so the budget still lands exactly.
  if (spent() < budget) {
    const double = entries.findIndex(
      (e) => skillPointCost(e.skillId, 0, 1) === 2 && e.level > floor,
    );
    const singles = entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => skillPointCost(e.skillId, 0, 1) === 1 && e.level < cap);
    if (double >= 0 && singles.length > 0) {
      entries[double]!.level -= 1;
      for (const { i } of singles) {
        if (spent() >= budget) break;
        raiseTo(i, entries[i]!.level + 1);
      }
    }
  }

  return entries;
}

/**
 * Which preset the sheet currently IS, if any: the one whose allocation it
 * matches Level for Level. Lets the screen show a chosen card as chosen, and
 * show "your own" the moment the player moves a single point.
 */
export function matchingPreset(input: {
  method: Method;
  roleId: string;
  entries: SkillEntry[];
}): SkillPreset | null {
  const mine = new Map(
    input.entries.filter((e) => !e.granted).map((e) => [skillEntryKey(e), e.level] as const),
  );
  for (const preset of presetsFor(input.roleId)) {
    const theirs = presetEntries({ ...input, preset, current: input.entries });
    if (
      theirs.length === mine.size &&
      theirs.every((e) => mine.get(skillEntryKey(e)) === e.level)
    ) {
      return preset;
    }
  }
  return null;
}
