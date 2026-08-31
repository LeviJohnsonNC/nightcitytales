/**
 * The ripperdoc transaction: adapt live rows into the pure engine, then hand
 * the complete plan to the database's atomic boundary. The model sees only the
 * receipt after this succeeds.
 */
import {
  defaultRng,
  planCyberwareInstall,
  type CyberwareInstallPlan,
  type GamePhase,
  type RNG,
} from "@/engine";
import {
  installCyberware,
  type Campaign,
  type CampaignCyberware,
  type CampaignNpc,
  type CampaignVitals,
  type Json,
} from "@/lib/backend";

export type RipperdocInstallInput = {
  campaign: Campaign;
  vitals: CampaignVitals;
  cyberware: CampaignCyberware[];
  ripperdoc: CampaignNpc;
  phase: GamePhase;
  hookSituationKey: string | null;
  itemId: string;
  requestId?: string;
  rng?: RNG;
};

export type RipperdocInstallOutcome = {
  requestId: string;
  plan: CyberwareInstallPlan;
  ripperdocName: string;
  narrationFacts: string;
};

export type PreparedRipperdocInstall = {
  itemId: string;
  payload: Parameters<typeof installCyberware>[0];
  outcome: RipperdocInstallOutcome;
};

function rollJson(plan: CyberwareInstallPlan): Json {
  return {
    humanity: plan.humanityRolls.map((roll) => ({
      expression: roll.expression,
      rolls: roll.rolls,
      divisor: roll.divisor,
      total: roll.total,
    })),
    humanityBefore: plan.humanity.humanityBefore,
    humanityLost: plan.humanity.humanityLost,
    humanityAfter: plan.humanity.humanityCurrent,
    empAfter: plan.humanity.emp,
    cyberpsychosisRisk: plan.humanity.cyberpsychosisRisk,
  } as Json;
}

function receiptJson(
  plan: CyberwareInstallPlan,
  ripperdoc: CampaignNpc,
  hookSituationKey: string | null,
): Json {
  return {
    item_id: plan.itemId,
    item_name: plan.itemName,
    install_level: plan.installLevel,
    quantity: plan.quantity,
    cost: plan.cost,
    humanity_before: plan.humanity.humanityBefore,
    humanity_lost: plan.humanity.humanityLost,
    humanity_after: plan.humanity.humanityCurrent,
    emp_after: plan.humanity.emp,
    appointment_days: plan.appointmentDays,
    procedure_minutes: plan.procedureMinutes,
    recovery_days: plan.recoveryDays,
    day_before: plan.clockBefore.day,
    minute_before: plan.clockBefore.minute,
    day_after: plan.clockAfter.day,
    minute_after: plan.clockAfter.minute,
    passes_hook: plan.passesHook,
    hook_situation_key: hookSituationKey,
    ripperdoc_id: ripperdoc.id,
    ripperdoc_key: ripperdoc.npc_id,
    ripperdoc_name: ripperdoc.name,
  } as Json;
}

export function describeRipperdocResult(plan: CyberwareInstallPlan, ripperdocName: string): string {
  const dice = plan.humanityRolls
    .map((roll) => `${roll.expression ?? "0"} [${roll.rolls.join(", ") || "—"}] = ${roll.total}`)
    .join("; ");
  return [
    `FIXED RIPPERDOC RESULT. ${ripperdocName} installed ${plan.quantity > 1 ? `${plan.quantity} paired copies of ` : ""}${plan.itemName}.`,
    `The printed price was ${plan.cost}eb and includes surgery.`,
    `Humanity Loss was ${dice}: ${plan.humanity.humanityBefore} to ${plan.humanity.humanityCurrent}; current EMP is ${plan.humanity.emp}.`,
    `The appointment wait was ${plan.appointmentDays} day(s), surgery took ${plan.procedureMinutes} minutes, and recovery took ${plan.recoveryDays} day(s). The calendar is now Day ${plan.clockAfter.day}.`,
    plan.passesHook
      ? "Beginning surgery meant explicitly passing on the job that was on the table."
      : "No job offer was surrendered.",
    "Narrate the waiting room, procedure, disorientation, and recovery as lived fiction. Do not change or repeat the mechanical numbers, and propose no further action.",
  ].join("\n");
}

export function prepareRipperdocInstall(input: RipperdocInstallInput): PreparedRipperdocInstall {
  const requestId = input.requestId ?? crypto.randomUUID();
  const plan = planCyberwareInstall({
    installed: input.cyberware
      .filter((row) => hasCyberware(row.item_id))
      .map((row) => ({
        id: row.id,
        itemId: row.item_id,
        foundationId: row.foundational_for,
      })),

    itemId: input.itemId,
    humanityCurrent: input.vitals.humanity_current,
    eurobucks: input.vitals.eurobucks,
    disposition: input.ripperdoc.disposition,
    phase: input.phase,
    clock: { day: input.campaign.day, minute: input.campaign.minute },
    rng: input.rng ?? defaultRng,
  });
  const implants = plan.placements.map((placement, index) => ({
    id: crypto.randomUUID(),
    item_id: plan.itemId,
    install_location: null,
    humanity_loss: plan.humanityRolls[index]?.total ?? 0,
    foundational_for: placement.foundationId,
  }));
  const summary = `${input.ripperdoc.name} installed ${plan.quantity > 1 ? `${plan.quantity}× ` : ""}${plan.itemName} for ${plan.cost}eb; Humanity ${plan.humanity.humanityBefore} → ${plan.humanity.humanityCurrent}.`;
  const payload = {
    campaign_id: input.campaign.id,
    request_id: requestId,
    ripperdoc_id: input.ripperdoc.id,
    hook_situation_key: input.hookSituationKey,
    expected: {
      day: input.campaign.day,
      minute: input.campaign.minute,
      eurobucks: input.vitals.eurobucks,
      humanity: input.vitals.humanity_current,
    },
    implants,
    summary,
    roll: rollJson(plan),
    receipt: receiptJson(plan, input.ripperdoc, input.hookSituationKey),
  };
  const outcome = {
    requestId,
    plan,
    ripperdocName: input.ripperdoc.name,
    narrationFacts: describeRipperdocResult(plan, input.ripperdoc.name),
  };
  return { itemId: input.itemId, payload, outcome };
}

export async function commitRipperdocInstall(
  prepared: PreparedRipperdocInstall,
): Promise<RipperdocInstallOutcome> {
  await installCyberware(prepared.payload);
  return prepared.outcome;
}

export async function installAtRipperdoc(
  input: RipperdocInstallInput,
): Promise<RipperdocInstallOutcome> {
  return commitRipperdocInstall(prepareRipperdocInstall(input));
}
