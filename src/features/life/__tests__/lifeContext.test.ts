import { describe, expect, it } from "vitest";
import { generateCast, publicView, type DossierFact } from "@/engine";
import { renderLifeUserPrompt, type LifeContext } from "../lifeContext";

const BASE: LifeContext = {
  clock: { day: 3, minute: 20 * 60 + 47 },
  character: {
    name: "Vela Ruiz",
    handle: "Ratchet",
    role: "Solo",
    hp: 22,
    hpMax: 35,
    woundState: "serious",
    eurobucks: 140,
    stats: { ref: 7, cool: 6 },
    skills: [{ skill: "Trading", id: "trading", base: 6 }],
  },
  situation: null,
  otherSituations: [],
  clocks: [],
  people: [],
  recentEvents: [],
};

const WIRE = {
  title: "Retrieval in Watson",
  brokerName: "Wakako Okada",
  brokerKey: "wakako_okada",
  brokerLine: "who takes her cut off the top",
  district: "Watson",
  pitch: "A client she will not name wants a crate out of Watson.",
  ask: "Bring the crate back intact",
  payout: 1250,
};

describe("the Life prompt", () => {
  it("says nothing about work when there is none on the wire", () => {
    const prompt = renderLifeUserPrompt(BASE, "I go get a drink.");
    expect(prompt).not.toContain("WORK ON THE WIRE");
    expect(prompt).not.toContain("OFFER ALREADY ON THE TABLE");
  });

  it("puts the whole offer in front of the model, and forbids changing it", () => {
    const prompt = renderLifeUserPrompt({ ...BASE, wire: WIRE }, "");
    expect(prompt).toContain("WORK ON THE WIRE");
    expect(prompt).toContain("Wakako Okada");
    expect(prompt).toContain("1250eb");
    expect(prompt).toContain("Bring the crate back intact");
    expect(prompt).toContain("hook_offer");
    expect(prompt).toContain("Change nothing");
  });

  it("shows an offer on the table with only the facts the player has bought", () => {
    const prompt = renderLifeUserPrompt(
      { ...BASE, hookOnTable: { ...WIRE, learned: ["Waiting: Tyger Claws, three of them"] } },
      "",
    );
    expect(prompt).toContain("OFFER ALREADY ON THE TABLE");
    expect(prompt).toContain("Tyger Claws");
    expect(prompt).toContain("has not agreed to anything");
  });

  it("says nothing about options unless the player asked", () => {
    expect(renderLifeUserPrompt(BASE, "I pick the lock.")).not.toContain(
      "THEY ARE ASKING WHAT THEY COULD DO",
    );
    const asked = renderLifeUserPrompt({ ...BASE, optionsRequested: true }, "");
    expect(asked).toContain("THEY ARE ASKING WHAT THEY COULD DO");
    expect(asked).toContain("timeSpent to 0");
  });

  it("still hands over the truth about the character every turn", () => {
    const prompt = renderLifeUserPrompt(BASE, "I check my messages.");
    expect(prompt).toContain("HP 22/35 (serious)");
    expect(prompt).toContain("140eb");
    expect(prompt).toContain("Trading [trading] +6");
    expect(prompt).toContain("I check my messages.");
  });
});

describe("the people block", () => {
  const cast = generateCast({ seed: 0xca57 });

  /** The people block as useLife builds it, for a given state of knowledge. */
  const peopleWith = (known: DossierFact[]) =>
    cast.map((member) => {
      const view = publicView(member, known);
      return {
        key: view.key,
        name: view.name,
        disposition: view.disposition,
        status: "alive",
        role: view.role,
        standing: view.standing,
        ...(view.tie ? { tie: view.tie } : {}),
        ...(view.known.length ? { known: view.known } : {}),
      };
    });

  it("never puts a hidden fact in front of the model", () => {
    const prompt = renderLifeUserPrompt({ ...BASE, people: peopleWith([]) }, "I go for a walk.");
    for (const member of cast) {
      expect(prompt).not.toContain(member.dossier.wants);
      expect(prompt).not.toContain(member.dossier.fear);
      expect(prompt).not.toContain(member.dossier.secret);
      expect(prompt).not.toContain(member.dossier.breakingPoint);
    }
  });

  it("hands over a fact once the player has earned it, and no more", () => {
    const prompt = renderLifeUserPrompt(
      { ...BASE, people: peopleWith(["wants"]) },
      "I go for a walk.",
    );
    for (const member of cast) {
      expect(prompt).toContain(member.dossier.wants);
      expect(prompt).not.toContain(member.dossier.fear);
      expect(prompt).not.toContain(member.dossier.secret);
    }
  });

  it("keeps the breaking point out even when everything else is known", () => {
    const prompt = renderLifeUserPrompt(
      { ...BASE, people: peopleWith(["wants", "fear", "secret"]) },
      "I go for a walk.",
    );
    for (const member of cast) {
      expect(prompt).not.toContain(member.dossier.breakingPoint);
    }
  });

  it("tells the model these are the people, and that it does not know the rest", () => {
    const prompt = renderLifeUserPrompt({ ...BASE, people: peopleWith([]) }, "");
    expect(prompt).toContain("do not invent new named faces");
    expect(prompt).toContain("never");
    expect(prompt).toContain("invent a want, a fear or a secret");
    for (const member of cast) {
      expect(prompt).toContain(member.name);
      expect(prompt).toContain(member.standing);
    }
  });
});
