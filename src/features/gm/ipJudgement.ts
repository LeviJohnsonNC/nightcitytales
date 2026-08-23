/**
 * End-of-session I.P. judgement. The GM reads the printed award table and says
 * which tier the session earned; the engine (awardImprovementPoints) computes
 * the number. The model never invents a value: it may only pick a printed tier.
 */
import { z } from "zod";
import { IP_AWARDS, IP_PLAYSTYLES, IP_TIER_VALUES, snapToIpTier, type IpPlaystyle } from "@/engine";
import { CYBERPUNK_STYLE_GUIDE } from "@/lib/prose-style";

const PLAYSTYLE_IDS = IP_PLAYSTYLES.map((p) => p.id) as [IpPlaystyle, ...IpPlaystyle[]];

/** The loose wire shape (models drift on field names and value types). */
export const IpJudgementWireSchema = z.object({
  groupIp: z.number().nullish(),
  primaryIp: z.number().nullish(),
  secondaryIp: z.number().nullish(),
  standoutPlaystyle: z.string().nullish(),
  standoutIp: z.number().nullish(),
  standoutReason: z.string().nullish(),
  reason: z.string().nullish(),
});
export type IpJudgementWire = z.infer<typeof IpJudgementWireSchema>;

export type IpJudgement = {
  groupIp: number;
  primaryIp: number;
  secondaryIp: number;
  standout: { playstyle: IpPlaystyle; ip: number; reason: string } | null;
  reason: string;
};

const LOWEST = Math.min(...IP_TIER_VALUES);

/** Narrow the model's judgement into printed tier values only. */
export function normalizeIpJudgement(wire: IpJudgementWire): IpJudgement {
  const tier = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? snapToIpTier(Math.round(value)) : LOWEST;

  const rawPlaystyle = (wire.standoutPlaystyle ?? "").trim().toLowerCase();
  const playstyle = PLAYSTYLE_IDS.find((id) => id === rawPlaystyle) ?? null;
  const standoutIp = typeof wire.standoutIp === "number" ? tier(wire.standoutIp) : null;

  return {
    groupIp: tier(wire.groupIp),
    primaryIp: tier(wire.primaryIp),
    secondaryIp: tier(wire.secondaryIp),
    standout:
      playstyle && standoutIp
        ? {
            playstyle,
            ip: standoutIp,
            reason: (wire.standoutReason ?? "").trim() || "A standout moment this session.",
          }
        : null,
    reason: (wire.reason ?? "").trim() || "Judged against the printed award table.",
  };
}

export type IpJudgementContext = {
  missionTitle: string;
  missionFinished: boolean;
  outcome: string;
  objectives: { text: string; status: string }[];
  primary: IpPlaystyle;
  secondary: IpPlaystyle;
  /** The session, in the ledger's own words (oldest first). */
  log: string[];
  rollCount: number;
};

function tableBlock(): string {
  return IP_AWARDS.tiers
    .map(
      (t) =>
        `${t.ip} IP — GROUP: ${t.group} | WARRIOR: ${t.warrior} | SOCIALIZER: ${t.socializer} | EXPLORER: ${t.explorer} | ROLEPLAYER: ${t.roleplayer}`,
    )
    .join("\n");
}

export const IP_JUDGEMENT_SYSTEM_PROMPT = `${CYBERPUNK_STYLE_GUIDE}

You are the Game Master awarding Improvement Points at the end of a Cyberpunk RED session, using the published award table and nothing else.

RULES
- ${IP_AWARDS._rules.finished}
- ${IP_AWARDS._rules.unfinished}
- You NEVER invent a value. Every number you return is one of these exact I.P. values: ${IP_TIER_VALUES.join(", ")}.
- Pick each value by matching what actually happened in the session against the printed descriptors. Be honest: a thin session is a 10 or a 20, not a 60.
- Award a standout only if one playstyle's play genuinely deserves a higher tier than the base award. If nothing stood out, return no standout.

THE TABLE
${tableBlock()}

OUTPUT
- groupIp: the Group column tier for this session.
- primaryIp / secondaryIp: the tier the character earned in each of their declared playstyles.
- standoutPlaystyle (one of ${PLAYSTYLE_IDS.join(", ")}), standoutIp and standoutReason: only when a standout moment earns more.
- reason: one or two sentences, in voice, on why the session landed where it did.`;

export function renderIpJudgementPrompt(ctx: IpJudgementContext): string {
  const objectives = ctx.objectives.length
    ? ctx.objectives.map((o) => `- [${o.status}] ${o.text}`).join("\n")
    : "- (none recorded)";
  return `MISSION: ${ctx.missionTitle}
MISSION FINISHED: ${ctx.missionFinished ? "yes" : "no"}
OUTCOME: ${ctx.outcome}
DECLARED PLAYSTYLES: primary ${ctx.primary}, secondary ${ctx.secondary}
DICE ROLLED THIS SESSION: ${ctx.rollCount}

OBJECTIVES
${objectives}

SESSION LOG (oldest first)
${ctx.log.join("\n")}

Judge the Improvement Points for this session.`;
}
