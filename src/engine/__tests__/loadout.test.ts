import { describe, expect, it } from "vitest";
import {
  EMPTY_LOADOUT,
  addPurchase,
  budgetStates,
  canPurchase,
  eurobucksKept,
  evaporatingBudgets,
  foundations,
  loadoutHumanity,
  removeLine,
  type Loadout,
} from "../loadout";
import { choicePoints, unresolvedChoices } from "../gearPackages";

function buy(loadout: Loadout, req: Parameters<typeof addPurchase>[2], method = "complete_package" as const) {
  return addPurchase(method, loadout, req);
}

describe("budgets", () => {
  it("gives Complete Package two separate budgets from the rules data", () => {
    const budgets = budgetStates("complete_package", EMPTY_LOADOUT);
    expect(budgets.map((b) => [b.id, b.limit, b.unspentKept])).toEqual([
      ["gear", 2550, true],
      ["fashion", 800, false],
    ]);
  });

  it("gives package methods a single 500eb kept budget", () => {
    const budgets = budgetStates("streetrat", EMPTY_LOADOUT);
    expect(budgets).toHaveLength(1);
    expect(budgets[0]!.limit).toBe(500);
    expect(budgets[0]!.unspentKept).toBe(true);
  });

  it("refuses to buy a weapon with fashion money", () => {
    const check = canPurchase("complete_package", EMPTY_LOADOUT, {
      kind: "weapon",
      itemId: "assault_rifle",
      budget: "fashion",
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/fashion money/i);
  });

  it("allows fashionware on fashion money", () => {
    expect(
      canPurchase("complete_package", EMPTY_LOADOUT, {
        kind: "cyberware",
        itemId: "light_tattoo",
        budget: "fashion",
      }).ok,
    ).toBe(true);
  });

  it("keeps unspent gear money and loses unspent fashion money", () => {
    const loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "light_tattoo", budget: "fashion" });
    expect(eurobucksKept("complete_package", loadout)).toBe(2550);
    expect(evaporatingBudgets("complete_package", loadout)[0]!.remaining).toBe(700);
  });

  it("blocks a purchase that exceeds the budget", () => {
    const loadout = buy(EMPTY_LOADOUT, { kind: "armor", itemId: "metalgear", budget: "gear" });
    const check = canPurchase("complete_package", loadout, {
      kind: "armor",
      itemId: "metalgear",
      budget: "gear",
      location: "head",
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/left in/);
  });
});

describe("armor", () => {
  it("allows one armor per location and stores current SP apart from base SP", () => {
    let loadout = buy(EMPTY_LOADOUT, {
      kind: "armor",
      itemId: "light_armorjack",
      budget: "gear",
      location: "body",
    });
    const line = loadout.lines[0]!;
    expect(line.currentSp).toBe(11);

    const second = canPurchase("complete_package", loadout, {
      kind: "armor",
      itemId: "kevlar",
      budget: "gear",
      location: "body",
    });
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/only one armor per location/i);

    loadout = buy(loadout, { kind: "armor", itemId: "kevlar", budget: "gear", location: "head" });
    expect(loadout.lines).toHaveLength(2);
  });
});

describe("cyberware install rules", () => {
  it("blocks an option whose foundation is not installed", () => {
    const check = canPurchase("complete_package", EMPTY_LOADOUT, {
      kind: "cyberware",
      itemId: "kerenzikov",
      budget: "gear",
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/Neural Link/);
  });

  it("fills foundation slots and refuses the overflow", () => {
    let loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "neural_link", budget: "gear" });
    for (const id of ["braindance_recorder", "chipware_socket", "interface_plugs", "sandevistan"]) {
      loadout = buy(loadout, { kind: "cyberware", itemId: id, budget: "gear" });
    }
    expect(foundations(loadout)[0]!.used).toBe(4);
    expect(foundations(loadout)[0]!.slots).toBe(5);
    loadout = buy(loadout, { kind: "cyberware", itemId: "kerenzikov", budget: "gear" });
    expect(foundations(loadout)[0]!.free).toBe(0);
    // A sixth option has nowhere to go.
    const overflow = canPurchase("complete_package", loadout, {
      kind: "cyberware",
      itemId: "braindance_recorder",
      budget: "gear",
    });
    expect(overflow.ok).toBe(false);
    expect(overflow.reason).toMatch(/full/i);
  });

  it("honours maxInstalls on the Cyberaudio Suite", () => {
    const loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "cyberaudio_suite", budget: "gear" });
    const check = canPurchase("complete_package", loadout, {
      kind: "cyberware",
      itemId: "cyberaudio_suite",
      budget: "gear",
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/only install 1/i);
  });

  it("allows more than one Cybereye because slots are per unit", () => {
    const loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "cybereye", budget: "gear" });
    expect(
      canPurchase("complete_package", loadout, { kind: "cyberware", itemId: "cybereye", budget: "gear" }).ok,
    ).toBe(true);
  });

  it("removes slotted options when the foundation is removed", () => {
    let loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "neural_link", budget: "gear" });
    loadout = buy(loadout, { kind: "cyberware", itemId: "chipware_socket", budget: "gear" });
    loadout = removeLine(loadout, loadout.lines[0]!.lineId);
    expect(loadout.lines).toHaveLength(0);
  });
});

describe("humanity from installed cyberware", () => {
  it("uses the preset flat loss, never dice", () => {
    let loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "neural_link", budget: "gear" });
    loadout = buy(loadout, { kind: "cyberware", itemId: "kerenzikov", budget: "gear" });
    const result = loadoutHumanity(60, loadout);
    expect(result.humanityLost).toBe(21);
    expect(result.humanitySheet).toBe(39);
    expect(result.emp).toBe(3);
    expect(result.cyberpsychosisRisk).toBe(false);
  });

  it("flags cyberpsychosis when the installs overrun Humanity", () => {
    let loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "neural_link", budget: "gear" });
    loadout = buy(loadout, { kind: "cyberware", itemId: "cyberarm", budget: "gear" });
    expect(loadoutHumanity(10, loadout).cyberpsychosisRisk).toBe(true);
  });

  it("charges no Humanity for fashionware", () => {
    const loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "light_tattoo", budget: "fashion" });
    expect(loadoutHumanity(60, loadout).humanityLost).toBe(0);
  });
});

describe("fixed package choices", () => {
  it("reads every either/or point for a Role", () => {
    const points = choicePoints("solo");
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]!.options.length).toBeGreaterThan(1);
    expect(unresolvedChoices("solo", {})).toHaveLength(points.length);
    const picked = { [points[0]!.id]: points[0]!.options[0]! };
    expect(unresolvedChoices("solo", picked)).toHaveLength(points.length - 1);
  });
});
