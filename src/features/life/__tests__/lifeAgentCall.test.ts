import { describe, expect, it } from "vitest";
import { AGENT_CALL_ENDED, agentCallEventData, readAgentCallEventData } from "@/engine";
import type { CampaignEvent } from "@/lib/backend";
import { currentAgentCall, resolveAgentCall } from "../lifeAgentCall";
import type { LifeContext } from "../lifeContext";
import { normalizeLifeResponse } from "../lifeResponse";

const yuri = {
  key: "fixer-1",
  name: "Yuri Pastrana",
  role: "fixer",
  status: "alive",
  disposition: 0,
};
const people = [yuri];
const outgoing = {
  state: "connected",
  direction: "outgoing",
  contact: "Yuri",
} as const;
const saved = {
  contactKey: yuri.key,
  name: yuri.name,
  role: "Fixer",
  direction: "outgoing",
} as const;

const row = (type: string, data: CampaignEvent["data"] = {}) => ({ type, data }) as CampaignEvent;

describe("Agent call state", () => {
  it("uses a roster identity, even if the narrator returns the first name", () => {
    expect(resolveAgentCall(outgoing, { people, situation: null }, "I call Yuri.")).toEqual(saved);
    expect(resolveAgentCall(outgoing, { people, situation: null }, "")).toBeNull();
    expect(
      resolveAgentCall(
        { ...outgoing, contact: "An invented caller" },
        { people, situation: null },
        "I dial.",
      ),
    ).toBeNull();
  });

  it("uses an incoming caller from the selected situation or the existing wire offer", () => {
    const call = { ...outgoing, direction: "incoming" } as const;
    const situation = { npcKey: yuri.key } as LifeContext["situation"];
    expect(resolveAgentCall(call, { people, situation }, "")?.direction).toBe("incoming");
    expect(resolveAgentCall(call, { people, situation, inScene: true }, "")).toBeNull();
    expect(resolveAgentCall(call, { people, situation: null }, "")).toBeNull();
    const wire = { brokerKey: yuri.key, brokerName: yuri.name } as LifeContext["wire"];
    expect(resolveAgentCall(call, { people: [], situation: null, wire }, "")).toEqual({
      ...saved,
      direction: "incoming",
    });
  });

  it("keeps the original direction through replies and closes explicitly", () => {
    const context = { people, situation: null, agentCall: saved };
    expect(resolveAgentCall(undefined, context, "Who else knows?")).toBe(saved);
    expect(resolveAgentCall({ ...outgoing, direction: "incoming" }, context, "Thanks.")).toBe(
      saved,
    );
    expect(resolveAgentCall({ state: "ended" }, context, "I hang up.")).toBeNull();
  });

  it("round-trips the saved exchange and ignores options, loose tags, and prior scenes", () => {
    const data = agentCallEventData(saved);
    const passage = row("life_narration", data);
    expect(readAgentCallEventData(data)).toEqual(saved);
    expect(currentAgentCall([passage, row("player_input"), row("life_options")])).toEqual(saved);
    for (const end of [AGENT_CALL_ENDED, "travelled", "neighborhood_action", "life_narration"]) {
      expect(currentAgentCall([passage, row(end)])).toBeNull();
    }
    expect(
      normalizeLifeResponse({ agentCall: { ...outgoing, direction: "text" } }).agentCall,
    ).toBeUndefined();
    expect(normalizeLifeResponse({ agentCall: outgoing }).agentCall).toEqual(outgoing);
    expect(readAgentCallEventData({ agentCall: { name: "Yuri" } })).toBeNull();
  });
});
