import { describe, expect, it } from "vitest";
import { dueArcBeat, fillArc, freshArcState, getArc, involve } from "@/engine";
import type { CampaignNpc } from "@/lib/backend";
import { lifePeople } from "@/features/life/lifeModel";
import { renderLifeUserPrompt, type LifeContext } from "@/features/life/lifeContext";
import {
  arcLearnedOf,
  arcPeopleFor,
  arcPersonFor,
  arcSituationKey,
  arcTellFor,
  situationForBeat,
} from "../arcs";

function npcRow(npcId: string, name: string, role: string, data: object = {}): CampaignNpc {
  return {
    id: `row-${npcId}`,
    npc_id: npcId,
    name,
    status: "alive",
    disposition: 0,
    data: {
      role,
      standing: "",
      dossier: {
        wants: "out",
        fear: "being found",
        secret: "owes somebody",
        breakingPoint: "a name they will not say",
      },
      ...data,
    },
  } as unknown as CampaignNpc;
}

describe("reading a campaign's people into their stories", () => {
  it("gives each of the six an arc that fits their role", () => {
    const people = arcPeopleFor(
      [npcRow("kiro", "Kiro", "friend"), npcRow("sable", "Sable", "fixer")],
      "c1",
    );
    expect(people.map((p) => p.key)).toEqual(["kiro", "sable"]);
    expect(people[0]!.arc.roles).toContain("friend");
    expect(people[1]!.arc.roles).toContain("fixer");
  });

  it("reads a stored story rather than rolling a new one", () => {
    const arc = getArc("the_debt")!;
    const stored = { ...freshArcState(arc), stage: 2, lastDay: 7 };
    const person = arcPersonFor(npcRow("kiro", "Kiro", "friend", { arc: stored }), "c1")!;
    expect(person.arc.id).toBe("the_debt");
    expect(person.state.stage).toBe(2);
  });

  it("leaves the dead and the strangers out", () => {
    const dead = { ...npcRow("kiro", "Kiro", "friend"), status: "dead" } as CampaignNpc;
    const stranger = { npc_id: "bartender", name: "Bartender", status: "alive", data: {} };
    expect(arcPeopleFor([dead, stranger as unknown as CampaignNpc], "c1")).toEqual([]);
  });
});

describe("a beat, as the player meets it", () => {
  const arc = getArc("the_debt")!;
  const at = (stage: number) => ({ ...freshArcState(arc), stage, lastDay: 0 });
  const kiro = (stage: number) => ({ key: "kiro", name: "Kiro", arc, state: at(stage) });

  it("is filed under the person, and tells the narrator only what was seen", () => {
    const fired = dueArcBeat([kiro(1)], 30)!;
    const situation = situationForBeat(fired, 30);
    expect(situation.situationKey).toBe(arcSituationKey("kiro"));
    expect(situation.npcKey).toBe("kiro");
    expect(situation.summary).toBe(fillArc(fired.beat.brief, "Kiro"));
    // The truth behind it is never part of what the model is sent.
    expect(JSON.stringify(situation)).not.toContain("loan shark");
  });

  it("carries a deadline only when the move does", () => {
    const quiet = situationForBeat(dueArcBeat([kiro(0)], 30)!, 30);
    expect(quiet.dueDay).toBeNull();
  });
});

describe("what the player sees of somebody's story", () => {
  const arc = getArc("the_debt")!;

  it("shows the foreshadowing before anything has happened", () => {
    expect(arcTellFor(npcRow("kiro", "Kiro", "friend", { arc: freshArcState(arc) }), "c1")).toBe(
      fillArc(arc.foreshadow, "Kiro"),
    );
  });

  it("files what involvement taught them with what they have worked out", () => {
    let state = freshArcState(arc);
    state = dueArcBeat([{ key: "kiro", name: "Kiro", arc, state }], 10)!.next;
    state = dueArcBeat([{ key: "kiro", name: "Kiro", arc, state }], 20)!.next;
    state = involve(arc, state, "Kiro");
    const row = npcRow("kiro", "Kiro", "friend", { arc: state });
    expect(arcLearnedOf(row)).toHaveLength(1);
    const [person] = lifePeople([row], 20);
    expect(person!.known).toContain(arcLearnedOf(row)[0]);
  });

  it("tells the narrator what anybody could see, and nothing behind it", () => {
    const context: LifeContext = {
      clock: { day: 3, minute: 21 * 60 },
      character: {
        name: "V",
        role: "Solo",
        hp: 30,
        hpMax: 30,
        woundState: "none",
        eurobucks: 100,
        stats: {},
        skills: [],
      },
      situation: null,
      otherSituations: [],
      clocks: [],
      people: [],
      recentEvents: [],
      place: {
        where: "The Paper Lantern",
        district: "Old Japantown",
        area: "The Island",
        security: "Kimen-Gumi",
        gangs: [],
        combatZone: false,
        nearby: [],
        whoIsHere: { name: "Kiro", key: "kiro", tell: "Kiro keeps counting their cash twice." },
      },
    };
    const packet = renderLifeUserPrompt(context, "x");
    expect(packet).toContain("Kiro keeps counting their cash twice.");
    expect(packet).toContain("do not have them explain it");
  });
});
