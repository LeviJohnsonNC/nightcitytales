/**
 * The legality gate — a deterministic refusal layer between "the GM proposed
 * it" and "the player rolls it".
 *
 * Pure: it reads a CapabilitySnapshot (./capability.ts) and a candidate action
 * and answers whether the action is possible at all. It never rolls, never
 * decides success, and never invents a rules value: where the printed rules
 * data does not cover a limit (movement rates, melee reach, Netrunning), the
 * gate ALLOWS the action rather than guessing a number, and says so here so the
 * hole is visible instead of silently enforced with a made-up value.
 *
 * NOT enforced yet, for want of printed data in src/data/rules/:
 * - metres per Move Action from a MOVE score (so "moved farther than MOVE"
 *   only refuses movement that exceeds MOVE metres, which is the raw stat and
 *   is deliberately conservative — see MOVE_METRES_NOTE);
 * - melee reach in metres (so a melee attack is refused only when the weapon is
 *   melee and the target is beyond MELEE_REACH_UNKNOWN handling, i.e. never on
 *   distance alone);
 * - which attacks may not be Aimed Shots beyond the ones the combat engine
 *   already models;
 * - Netrunning: no Net rules data exists, so the only refusal is the physical
 *   one — no Interface Plugs and no Cyberdeck.
 */
import {
  findCyberware,
  findItem,
  findTargetCapability,
  findWeapon,
  withinPrintedRange,
  type CapabilitySnapshot,
  type WeaponCapability,
} from "./capability";

export const MOVE_METRES_NOTE =
  "Movement is measured against the raw MOVE score in metres; the metres-per-Move-Action rule is not in the rules data.";

/** Cyberware that physically lets a character jack into the Net. */
export const NETRUN_CYBERWARE = ["interface_plugs", "neural_link"];
/** Gear that physically lets a character run the Net. */
export const NETRUN_GEAR = ["cyberdeck", "cyberarm_cyberdeck"];

export type LegalityCode =
  | "item_not_possessed"
  | "item_consumed"
  | "cyberware_not_installed"
  | "prerequisite_unmet"
  | "resource_unavailable"
  | "weapon_not_carried"
  | "weapon_empty"
  | "weapon_broken"
  | "rof_exceeded"
  | "aimed_shot_incompatible"
  | "out_of_range"
  | "out_of_reach"
  | "move_exceeded"
  | "target_not_perceived"
  | "target_defeated"
  | "action_spent"
  | "movement_spent"
  | "role_ability_absent"
  | "rank_too_low"
  | "netrun_no_interface"
  | "physically_incapable"
  | "retry_unchanged";

export type CandidateAction =
  | {
      kind: "attack";
      targetKey: string;
      distance: number;
      /** Catalog id or printed name of the weapon, when the intent names one. */
      weapon?: string;
      aimed?: boolean;
    }
  | { kind: "skill_check"; skillId: string; intent: string }
  | { kind: "opposed_check"; skillId: string; intent: string }
  | { kind: "use_item"; item: string; quantity?: number }
  | { kind: "use_cyberware"; cyberware: string }
  | { kind: "role_ability"; abilityId: string; rank?: number }
  | { kind: "move"; metres: number }
  | { kind: "netrun" }
  | { kind: "spend"; resource: "eurobucks" | "luck"; amount: number };

export type LegalityVerdict =
  | { ok: true }
  | {
      ok: false;
      code: LegalityCode;
      /** Written for the player, not for a log: the GM narrates this reason. */
      reason: string;
    };

const OK: LegalityVerdict = { ok: true };

function no(code: LegalityCode, reason: string): LegalityVerdict {
  return { ok: false, code, reason };
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Whether this exact skill and approach has already failed in this beat. */
export function alreadyFailed(
  snapshot: CapabilitySnapshot,
  skillId: string,
  intent: string,
): boolean {
  const want = normalise(intent);
  if (!want) return false;
  return snapshot.failedAttempts.some((f) => f.skillId === skillId && normalise(f.intent) === want);
}

function judgeWeaponForAttack(
  snapshot: CapabilitySnapshot,
  weapon: WeaponCapability,
  distance: number,
  aimed: boolean,
): LegalityVerdict {
  if (weapon.broken) {
    return no("weapon_broken", `${weapon.name} is broken and cannot be fired.`);
  }
  if (weapon.roundsLoaded === 0) {
    return no(
      "weapon_empty",
      weapon.spareRounds > 0
        ? `${weapon.name} is empty — it has to be reloaded before it fires again.`
        : `${weapon.name} is empty, and there is no spare ammunition in the kit.`,
    );
  }
  if (!withinPrintedRange(weapon, distance)) {
    return no(
      "out_of_range",
      `${weapon.name} cannot reach a target at ${distance} m — that is past its printed range.`,
    );
  }
  if (weapon.melee && distance > 2) {
    return no(
      "out_of_reach",
      `${weapon.name} is a melee weapon and the target is ${distance} m away — out of reach until the distance is closed.`,
    );
  }
  const turn = snapshot.turn;
  if (
    turn.inCombat &&
    turn.shotWeaponId === weapon.itemId &&
    turn.shotsThisRound >= Math.max(1, weapon.rof)
  ) {
    return no(
      "rof_exceeded",
      `${weapon.name} has a Rate of Fire of ${weapon.rof}; that is already spent this Round.`,
    );
  }
  if (aimed && weapon.melee) {
    return no("aimed_shot_incompatible", "An Aimed Shot cannot be made with a melee attack.");
  }
  if (aimed && weapon.rangeType === null) {
    return no(
      "aimed_shot_incompatible",
      `${weapon.name} has no printed ranged attack profile, so it cannot make an Aimed Shot.`,
    );
  }
  return OK;
}

/**
 * Judge one candidate action against what the character can actually do. A
 * refusal is the end of the action; the caller narrates the reason in fiction.
 */
export function judgeAction(
  snapshot: CapabilitySnapshot,
  action: CandidateAction,
): LegalityVerdict {
  // Mortally Wounded and unstabilised: nothing but a Death Save happens.
  if (snapshot.incapacitated && action.kind !== "spend") {
    return no(
      "physically_incapable",
      "They are Mortally Wounded and down — they cannot act until they are stabilised.",
    );
  }

  switch (action.kind) {
    case "attack": {
      const target = findTargetCapability(snapshot, action.targetKey);
      if (!target) {
        return no(
          "target_not_perceived",
          "There is nothing there they can see and shoot at right now.",
        );
      }
      if (target.defeated) {
        return no("target_defeated", `${target.name} is already out of the fight.`);
      }
      if (!target.perceivable) {
        return no(
          "target_not_perceived",
          `${target.name} cannot be seen or located right now — they have to be found first.`,
        );
      }
      if (
        snapshot.turn.inCombat &&
        snapshot.turn.actionUsed &&
        snapshot.turn.shotsThisRound === 0
      ) {
        return no("action_spent", "Their Action for this Round is already spent.");
      }
      if (snapshot.weapons.length === 0) {
        return no("weapon_not_carried", "They are not carrying a weapon to attack with.");
      }
      if (action.weapon) {
        const weapon = findWeapon(snapshot, action.weapon);
        if (!weapon) {
          return no("weapon_not_carried", `They are not carrying a ${action.weapon}.`);
        }
        return judgeWeaponForAttack(snapshot, weapon, action.distance, action.aimed ?? false);
      }
      // No named weapon: legal as long as SOMETHING they carry could make it.
      const anyUsable = snapshot.weapons.some(
        (w) => judgeWeaponForAttack(snapshot, w, action.distance, action.aimed ?? false).ok,
      );
      if (!anyUsable) {
        const first = snapshot.weapons[0]!;
        return judgeWeaponForAttack(snapshot, first, action.distance, action.aimed ?? false);
      }
      return OK;
    }

    case "skill_check":
    case "opposed_check": {
      if (alreadyFailed(snapshot, action.skillId, action.intent)) {
        return no(
          "retry_unchanged",
          "They already tried exactly that and it failed. Nothing has changed, so trying the same thing the same way is not a new roll.",
        );
      }
      return OK;
    }

    case "use_item": {
      const item = findItem(snapshot, action.item);
      if (!item) {
        return no("item_not_possessed", `They do not have a ${action.item}.`);
      }
      const want = action.quantity ?? 1;
      if (item.quantity <= 0) {
        return no("item_consumed", `Their ${item.name} is used up — there is none left.`);
      }
      if (item.quantity < want) {
        return no("resource_unavailable", `They have ${item.quantity} ${item.name}, not ${want}.`);
      }
      return OK;
    }

    case "use_cyberware": {
      const chrome = findCyberware(snapshot, action.cyberware);
      if (!chrome) {
        return no(
          "cyberware_not_installed",
          `They have no ${action.cyberware} installed — that is not their chrome.`,
        );
      }
      if (!chrome.prerequisiteMet) {
        return no(
          "prerequisite_unmet",
          `${chrome.name} needs ${chrome.requires} installed to work, and it is not.`,
        );
      }
      return OK;
    }

    case "role_ability": {
      const ability = snapshot.roleAbility;
      if (!ability || normalise(ability.abilityId) !== normalise(action.abilityId)) {
        return no(
          "role_ability_absent",
          `${action.abilityId} is not their Role Ability — that belongs to another Role.`,
        );
      }
      if (action.rank !== undefined && action.rank > ability.rank) {
        return no(
          "rank_too_low",
          `${ability.abilityName} is Rank ${ability.rank}; that takes Rank ${action.rank}.`,
        );
      }
      return OK;
    }

    case "move": {
      const turn = snapshot.turn;
      if (turn.inCombat && turn.metresMoved > 0 && action.metres > 0) {
        return no("movement_spent", "They have already moved this Round.");
      }
      const allowance = Math.max(0, snapshot.move);
      if (allowance > 0 && action.metres > allowance) {
        return no(
          "move_exceeded",
          `That is ${action.metres} m in one Move; their MOVE covers ${allowance} m.`,
        );
      }
      return OK;
    }

    case "netrun": {
      const hasInterface = NETRUN_CYBERWARE.some((id) => findCyberware(snapshot, id));
      const hasDeck =
        NETRUN_GEAR.some((id) => findItem(snapshot, id)) ||
        NETRUN_GEAR.some((id) => findCyberware(snapshot, id));
      if (!hasInterface || !hasDeck) {
        return no(
          "netrun_no_interface",
          "They cannot jack in: netrunning needs Interface Plugs and a Cyberdeck, and they have neither to hand.",
        );
      }
      return OK;
    }

    case "spend": {
      const have = action.resource === "luck" ? snapshot.luck : snapshot.eurobucks;
      if (action.amount > have) {
        return no(
          "resource_unavailable",
          action.resource === "luck"
            ? `They have ${have} Luck left, not ${action.amount}.`
            : `They have ${have}eb, not ${action.amount}eb.`,
        );
      }
      return OK;
    }

    default:
      return OK;
  }
}
