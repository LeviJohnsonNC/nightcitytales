/**
 * The fixed Streetrat / Edgerunner gear packages from
 * src/data/rules/gear-packages.json.
 */
import gearPackages from "@/data/rules/gear-packages.json";

export type PackageItem = { item: string; qty: number };
export type PackageChoice = { choice: string[] };
export type PackageEntry = PackageItem | PackageChoice;

export function isChoice(entry: PackageEntry): entry is PackageChoice {
  return (entry as PackageChoice).choice !== undefined;
}

export type RoleGearPackage = {
  id: string;
  weaponsArmor: PackageEntry[];
  gear: PackageEntry[];
  outfit: string[];
  cyberware: PackageEntry[];
  freeEurobucks: number;
};

const ROLE_PACKAGES = gearPackages.roles as unknown as Record<string, RoleGearPackage>;

export const GEAR_PACKAGE_RULES = gearPackages._rules;

/** Methods that receive a fixed package, read from the file. */
export const PACKAGE_METHODS = gearPackages._rules.appliesTo as string[];

/** Free eurobucks granted on top of the fixed package. */
export const PACKAGE_FREE_EUROBUCKS = gearPackages._rules.freeEurobucks as number;
export const PACKAGE_UNSPENT_KEPT = gearPackages._rules.unspentKept as boolean;

/** Notes the file carries about the packages, surfaced in the UI verbatim. */
export const PACKAGE_NOTES = {
  choice: gearPackages._rules.choiceRule as string,
  armor: gearPackages._rules.armorNote as string,
  cyberware: gearPackages._rules.cyberwareNote as string,
  outfit: gearPackages._rules.outfitNote as string,
};

export type FlaggedPackageItem = {
  role: string;
  field: string;
  item: string;
  issue: string;
  confidence: string;
};

export const PACKAGE_FLAGS = gearPackages._flagged as FlaggedPackageItem[];

export function getGearPackage(roleId: string): RoleGearPackage {
  const pkg = ROLE_PACKAGES[roleId];
  if (!pkg) {
    throw new Error(`No gear package for role "${roleId}" (src/data/rules/gear-packages.json)`);
  }
  return pkg;
}

/** Every choice point in a Role package, addressed as "<field>.<index>". */
export type ChoicePoint = { id: string; field: "weaponsArmor" | "gear" | "cyberware"; options: string[] };

export function choicePoints(roleId: string): ChoicePoint[] {
  const pkg = getGearPackage(roleId);
  const fields: ChoicePoint["field"][] = ["weaponsArmor", "gear", "cyberware"];
  const out: ChoicePoint[] = [];
  for (const field of fields) {
    pkg[field].forEach((entry, index) => {
      if (isChoice(entry)) out.push({ id: `${field}.${index}`, field, options: entry.choice });
    });
  }
  return out;
}

/** Which choice points still have no selection. */
export function unresolvedChoices(roleId: string, selections: Record<string, string>): ChoicePoint[] {
  return choicePoints(roleId).filter((point) => {
    const picked = selections[point.id];
    return !picked || !point.options.includes(picked);
  });
}
