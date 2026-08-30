import {
  NON_FOUNDATIONAL_CATEGORY_SLOT_CAP,
  RIPPERDOC_RULES,
  foundationRule,
  getCyberware,
  type InstallLevel,
} from "./catalog";
import { advanceClock } from "./clock";
import type { GameClock } from "./campaign";
import { rollDice } from "./dice";
import { applyCyberwareHumanityLoss, type HumanityLossResult } from "./humanity";
import type { GamePhase } from "./phase";
import type { RNG } from "./types";

export type InstalledCyberware = {
  id: string;
  itemId: string;
  foundationId: string | null;
};

export type CyberwarePlacement = {
  foundationId: string | null;
};

export type CyberwarePlacementPlan =
  | {
      ok: true;
      placements: CyberwarePlacement[];
    }
  | {
      ok: false;
      reason: string;
    };

type FoundationCapacity = {
  id: string;
  itemId: string;
  free: number;
};

function capacities(installed: InstalledCyberware[]): FoundationCapacity[] {
  return installed
    .filter((row) => getCyberware(row.itemId).foundational)
    .map((foundation) => {
      const def = getCyberware(foundation.itemId);
      const slots = def.providesSlots ?? foundationRule(def.id).slots;
      const used = installed
        .filter((row) => row.foundationId === foundation.id)
        .reduce((sum, row) => sum + getCyberware(row.itemId).slotsUsed, 0);
      return { id: foundation.id, itemId: foundation.itemId, free: slots - used };
    });
}

function exclusiveConflict(installed: InstalledCyberware[], itemId: string): string | null {
  for (const [label, members] of Object.entries(RIPPERDOC_RULES.exclusiveGroups)) {
    if (!members.includes(itemId)) continue;
    const conflict = installed.find((row) => members.includes(row.itemId));
    if (conflict) return `Only one ${label} system can be installed at a time.`;
  }
  return null;
}

/** Physical implants bought by one click. Paired options are purchased twice. */
export function installQuantity(itemId: string): number {
  return RIPPERDOC_RULES.paired.includes(itemId) ? 2 : 1;
}

/**
 * Place one or more physical implants into the character's current chrome.
 * This owns foundations and Option Slots for both chargen adapters and play.
 */
export function planCyberwarePlacement(
  installed: InstalledCyberware[],
  itemId: string,
  quantity = installQuantity(itemId),
  preferredFoundationIds: string[] = [],
): CyberwarePlacementPlan {
  const item = getCyberware(itemId);
  const count = Math.max(1, Math.trunc(quantity));
  const conflict = exclusiveConflict(installed, itemId);
  if (conflict) return { ok: false, reason: conflict };

  if (RIPPERDOC_RULES.paired.includes(itemId) && count % 2 !== 0) {
    return { ok: false, reason: `${item.name} must be installed as a paired set.` };
  }

  if (item.foundational) {
    const max = foundationRule(item.id).maxInstalls;
    const existing = installed.filter((row) => row.itemId === item.id).length;
    if (max !== undefined && existing + count > max) {
      return { ok: false, reason: `You can only install ${max} ${item.name}.` };
    }
    return { ok: true, placements: Array.from({ length: count }, () => ({ foundationId: null })) };
  }

  const anyOf = RIPPERDOC_RULES.requiresAnyFoundation[itemId] ?? null;
  const required = item.requires;
  if (required && !getCyberware(required).foundational) {
    if (!installed.some((row) => row.itemId === required)) {
      return { ok: false, reason: `${item.name} requires ${getCyberware(required).name}.` };
    }
    return { ok: true, placements: Array.from({ length: count }, () => ({ foundationId: null })) };
  }

  const foundationKinds = anyOf ?? (required ? [required] : []);
  if (foundationKinds.length > 0) {
    const available = capacities(installed).filter((row) => foundationKinds.includes(row.itemId));
    const placements: CyberwarePlacement[] = [];
    for (let index = 0; index < count; index += 1) {
      const paired = RIPPERDOC_RULES.paired.includes(itemId);
      const usedInPair = paired && index % 2 === 1 ? placements[index - 1]?.foundationId : null;
      const target = available
        .filter((row) => row.id !== usedInPair)
        .sort((a, b) => {
          const preferredA = preferredFoundationIds.includes(a.id) ? 1 : 0;
          const preferredB = preferredFoundationIds.includes(b.id) ? 1 : 0;
          return preferredB - preferredA || b.free - a.free || a.id.localeCompare(b.id);
        })
        .find((row) => row.free >= item.slotsUsed);
      if (!target) {
        const foundationNames = foundationKinds.map((id) => getCyberware(id).name).join(" or ");
        return {
          ok: false,
          reason: paired
            ? `${item.name} needs two different ${foundationNames} foundations with ${item.slotsUsed} free Option Slot(s) each.`
            : available.length === 0
              ? `${item.name} needs a ${foundationNames} installed first.`
              : `Every ${foundationNames} is full. ${item.name} needs ${item.slotsUsed} free Option Slot(s).`,
        };
      }
      placements.push({ foundationId: target.id });
      target.free -= item.slotsUsed;
    }
    return { ok: true, placements };
  }

  if (NON_FOUNDATIONAL_CATEGORY_SLOT_CAP !== null && item.slotsUsed > 0) {
    const used = installed
      .filter((row) => {
        const def = getCyberware(row.itemId);
        return !def.foundational && !def.requires && def.category === item.category;
      })
      .reduce((sum, row) => sum + getCyberware(row.itemId).slotsUsed, 0);
    if (used + item.slotsUsed * count > NON_FOUNDATIONAL_CATEGORY_SLOT_CAP) {
      return {
        ok: false,
        reason: `${item.name} would exceed the ${NON_FOUNDATIONAL_CATEGORY_SLOT_CAP}-slot ${item.category} limit.`,
      };
    }
  }

  return { ok: true, placements: Array.from({ length: count }, () => ({ foundationId: null })) };
}

export type HumanityRoll = {
  expression: string | null;
  rolls: number[];
  divisor: number;
  total: number;
};

/** Post-creation Humanity Loss, including RED's round-up `1d6/2` form. */
export function rollHumanityLoss(expression: string | null, rng: RNG): HumanityRoll {
  if (!expression) return { expression, rolls: [], divisor: 1, total: 0 };
  const match = /^(\d+)d(\d+)(?:\/(\d+))?$/.exec(expression.trim());
  if (!match) throw new Error(`Unsupported Humanity Loss expression "${expression}".`);
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const divisor = match[3] ? Number(match[3]) : 1;
  const rolls = rollDice(count, sides, rng);
  return {
    expression,
    rolls,
    divisor,
    total: Math.ceil(rolls.reduce((sum, value) => sum + value, 0) / divisor),
  };
}

export function appointmentDelayDays(disposition: number): number | null {
  if (disposition <= -3) return RIPPERDOC_RULES.appointmentDelayDaysByDisposition.hostile;
  if (disposition < 0) return RIPPERDOC_RULES.appointmentDelayDaysByDisposition.cold;
  if (disposition === 0) return RIPPERDOC_RULES.appointmentDelayDaysByDisposition.neutral;
  return RIPPERDOC_RULES.appointmentDelayDaysByDisposition.warm;
}

export type CyberwareInstallPlan = {
  itemId: string;
  itemName: string;
  installLevel: InstallLevel;
  quantity: number;
  cost: number;
  placements: CyberwarePlacement[];
  humanityRolls: HumanityRoll[];
  humanity: HumanityLossResult;
  appointmentDays: number;
  procedureMinutes: number;
  recoveryDays: number;
  clockBefore: GameClock;
  clockAfter: GameClock;
  passesHook: boolean;
};

export type PlanCyberwareInstallInput = {
  installed: InstalledCyberware[];
  itemId: string;
  humanityCurrent: number;
  eurobucks: number;
  disposition: number;
  phase: GamePhase;
  clock: GameClock;
  rng: RNG;
};

export function planCyberwareInstall(input: PlanCyberwareInstallInput): CyberwareInstallPlan {
  if (input.phase !== "life" && input.phase !== "hook") {
    throw new Error("Cyberware installation is only available between jobs.");
  }
  const item = getCyberware(input.itemId);
  const quantity = installQuantity(item.id);
  const placement = planCyberwarePlacement(input.installed, item.id, quantity);
  if (!placement.ok) throw new Error(placement.reason);
  const cost = item.cost * quantity;
  if (cost > input.eurobucks) {
    throw new Error(`${item.name} costs ${cost}eb and you have ${input.eurobucks}eb.`);
  }
  const delay = appointmentDelayDays(input.disposition);
  if (delay === null) throw new Error("Your ripperdoc will not put you on the table.");
  const installLevel = item.install as InstallLevel;
  if (!(installLevel in RIPPERDOC_RULES.recoveryDays)) {
    throw new Error(`${item.name} has an unsupported installation level: ${item.install}.`);
  }
  const humanityRolls = Array.from({ length: quantity }, () =>
    rollHumanityLoss(item.humanityLossDice, input.rng),
  );
  const humanity = applyCyberwareHumanityLoss(
    input.humanityCurrent,
    humanityRolls.map((roll) => roll.total),
  );
  const procedureMinutes = RIPPERDOC_RULES.procedureMinutesPerInstall * quantity;
  const recoveryDays = RIPPERDOC_RULES.recoveryDays[installLevel];
  const totalMinutes = (delay + recoveryDays) * 24 * 60 + procedureMinutes;
  return {
    itemId: item.id,
    itemName: item.name,
    installLevel,
    quantity,
    cost,
    placements: placement.placements,
    humanityRolls,
    humanity,
    appointmentDays: delay,
    procedureMinutes,
    recoveryDays,
    clockBefore: input.clock,
    clockAfter: advanceClock(input.clock, totalMinutes),
    passesHook: input.phase === "hook",
  };
}
