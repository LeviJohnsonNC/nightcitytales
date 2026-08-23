/**
 * End-of-session Improvement Point awards. Every number comes from
 * src/data/rules/ip-awards.json; nothing is invented here.
 *
 * The rule, as printed:
 * - Mission finished (successfully or unsuccessfully): award the Group column
 *   value for how the session went.
 * - Mission not finished: award the value from the player's Primary or
 *   Secondary Playstyle column.
 * - Either way, a standout moment in any playstyle that would award more points
 *   wins instead.
 */
import { IP_AWARDS, type IpTier } from "./rulesData";

export type IpPlaystyle = "warrior" | "socializer" | "explorer" | "roleplayer";

export const IP_PLAYSTYLES: { id: IpPlaystyle; name: string }[] = IP_AWARDS.playstyles.map((p) => ({
  id: p.id as IpPlaystyle,
  name: p.name,
}));

/** The legal I.P. values, ascending (10 … 80). */
export const IP_TIER_VALUES: number[] = IP_AWARDS.tiers.map((t) => t.ip);

export function isIpTierValue(value: number): boolean {
  return IP_TIER_VALUES.includes(value);
}

/** The tier row for an I.P. value. Throws if it is not a printed value. */
export function getIpTier(ip: number): IpTier {
  const tier = IP_AWARDS.tiers.find((t) => t.ip === ip);
  if (!tier) {
    throw new Error(`No I.P. tier worth ${ip} (src/data/rules/ip-awards.json)`);
  }
  return tier;
}

/** The printed descriptor for a column at a tier. */
export function ipDescriptor(ip: number, column: "group" | IpPlaystyle): string {
  return getIpTier(ip)[column];
}

/** Snap a judged value to the nearest printed tier at or below it. */
export function snapToIpTier(ip: number): number {
  const sorted = [...IP_TIER_VALUES].sort((a, b) => a - b);
  const first = sorted[0] as number;
  const last = sorted[sorted.length - 1] as number;
  if (ip <= first) return first;
  if (ip >= last) return last;
  let best = first;
  for (const value of sorted) if (value <= ip) best = value;
  return best;
}

export type IpStandout = { playstyle: IpPlaystyle; ip: number; reason?: string };

export type IpAwardInput = {
  /** True when the mission ended, win or lose. */
  missionFinished: boolean;
  /** The Group column tier for the session (used when the mission finished). */
  groupIp: number;
  /** The player's declared playstyles (used when the mission did not finish). */
  primary: IpPlaystyle;
  secondary: IpPlaystyle;
  /** The tier the player's play earned in each of their two playstyles. */
  primaryIp: number;
  secondaryIp: number;
  /** A standout moment in any playstyle, if the GM judged one. */
  standout?: IpStandout | null;
};

export type IpAward = {
  ip: number;
  /** Which column the award came from. */
  source: "group" | IpPlaystyle;
  /** The printed descriptor that justifies the award. */
  descriptor: string;
  /** True when a standout moment beat the base award. */
  fromStandout: boolean;
};

/** Compute the session's I.P. award. Highest applicable printed value wins. */
export function awardImprovementPoints(input: IpAwardInput): IpAward {
  const base: { ip: number; source: "group" | IpPlaystyle } = input.missionFinished
    ? { ip: snapToIpTier(input.groupIp), source: "group" }
    : snapToIpTier(input.primaryIp) >= snapToIpTier(input.secondaryIp)
      ? { ip: snapToIpTier(input.primaryIp), source: input.primary }
      : { ip: snapToIpTier(input.secondaryIp), source: input.secondary };

  const standoutIp = input.standout ? snapToIpTier(input.standout.ip) : 0;
  const useStandout = Boolean(input.standout) && standoutIp > base.ip;
  const winner: { ip: number; source: "group" | IpPlaystyle } = useStandout
    ? { ip: standoutIp, source: (input.standout as IpStandout).playstyle }
    : base;

  return {
    ip: winner.ip,
    source: winner.source,
    descriptor: ipDescriptor(winner.ip, winner.source),
    fromStandout: useStandout,
  };
}
