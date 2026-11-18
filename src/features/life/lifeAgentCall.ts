import { AGENT_CALL_ENDED, readAgentCallEventData, type AgentCall } from "@/engine";
import { findNpc } from "@/features/cast/npcDirectory";
import type { CampaignEvent } from "@/lib/backend";
import type { LifeContext } from "./lifeContext";

export type AgentCallSignal =
  { state: "connected"; contact: string; direction: AgentCall["direction"] } | { state: "ended" };

const callBoundaries = new Set([
  AGENT_CALL_ENDED,
  "travelled",
  "day_began",
  "moved_house",
  "neighborhood_action",
  "mission_started",
  "mission_completed",
  "phase_changed",
  "encounter_started",
  "encounter_ended",
]);

export function currentAgentCall(events: readonly CampaignEvent[]): AgentCall | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]!;
    if (callBoundaries.has(event.type)) return null;
    if (event.type === "life_narration") return readAgentCallEventData(event.data);
  }
  return null;
}

/** A call tag describes an exchange that was already possible this turn. */
export function resolveAgentCall(
  signal: AgentCallSignal | undefined,
  context: Pick<
    LifeContext,
    "agentCall" | "people" | "wire" | "hookOnTable" | "situation" | "inScene"
  >,
  input: string,
): AgentCall | null {
  if (signal?.state === "ended") return null;
  const current = context.agentCall ?? null;
  if (!signal) return current;

  const broker = context.wire ?? context.hookOnTable;
  const people = context.people.filter((person) => person.status !== "dead");
  const participants = people.map(({ key, name, role }) => ({ key, name, role }));
  if (broker && !participants.some(({ key }) => key === broker.brokerKey)) {
    participants.push({ key: broker.brokerKey, name: broker.brokerName, role: "Broker" });
  }

  const contact = signal.contact.toLowerCase();
  const exact = participants.find(
    ({ key, name }) => key.toLowerCase() === contact || name.toLowerCase() === contact,
  );
  const alias = findNpc(contact)?.name.toLowerCase();
  const matches = participants.filter(({ name }) => {
    const canonical = name.toLowerCase();
    return canonical === alias || canonical.split(/\s+/)[0] === contact;
  });
  const person = exact ?? (matches.length === 1 ? matches[0] : undefined);
  if (!person) return current;
  if (current?.contactKey === person.key) return current;

  if (signal.direction === "outgoing" && !input.trim()) return current;
  if (
    signal.direction === "incoming" &&
    person.key !== broker?.brokerKey &&
    (context.inScene || person.key !== context.situation?.npcKey)
  ) {
    return current;
  }

  return {
    contactKey: person.key,
    name: person.name,
    role: findNpc(person.name)?.role ?? person.role ?? "Contact",
    direction: signal.direction,
  };
}
