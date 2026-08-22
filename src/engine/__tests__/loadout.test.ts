import { describe, expect, it } from "vitest";
import {
  EMPTY_LOADOUT,
  addPurchase,
  budgetStates,
  canChangeQty,
  canPurchase,
  cartStacks,
  categorySlotUsage,
  changeQty,
  removeStack,
  eurobucksKept,
  evaporatingBudgets,
  foundations,
  loadoutHumanity,
  removeLine,
  type Loadout,
} from "../loadout";
import { choicePoints, unresolvedChoices } from "../gearPackages";
import { itemCost } from "../catalog";

function buy(
  loadout: Loadout,
  req: Parameters<typeof addPurchase>[2],
  method = "complete_package" as const,
) {
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
    const loadout = buy(EMPTY_LOADOUT, {
      kind: "cyberware",
      itemId: "light_tattoo",
      budget: "fashion",
    });
    expect(eurobucksKept("complete_package", loadout)).toBe(2550);
    expect(evaporatingBudgets("complete_package", loadout)[0]!.remaining).toBe(700);
  });

  it("blocks a purchase that exceeds the budget", () => {
    const check = canPurchase("complete_package", EMPTY_LOADOUT, {
      kind: "armor",
      itemId: "metalgear",
      budget: "gear",
      location: "body",
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
    expect(foundations(loadout)[0]!.free).toBe(1);

    // Fill the last slot and confirm the sixth option is refused on slots.
    // The lines are built directly so the rejection under test is the slot
    // rule, not the eurobuck budget.
    const full: Loadout = {
      packageChoices: {},
      lines: [
        ...loadout.lines,
        {
          lineId: "manual",
          kind: "cyberware",
          itemId: "kerenzikov",
          qty: 1,
          budget: "gear",
          foundationLineId: loadout.lines[0]!.lineId,
        },
      ],
    };
    expect(foundations(full)[0]!.free).toBe(0);
    const overflow = canPurchase("streetrat", full, {
      kind: "cyberware",
      itemId: "braindance_recorder",
      budget: "free",
    });
    expect(overflow.ok).toBe(false);
    expect(overflow.reason).toMatch(/full/i);
  });

  it("treats a non-foundational prerequisite as presence-only", () => {
    let loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "neural_link", budget: "gear" });
    expect(
      canPurchase("complete_package", loadout, {
        kind: "cyberware",
        itemId: "chemical_analyzer",
        budget: "gear",
      }).reason,
    ).toMatch(/Chipware Socket/);
    loadout = buy(loadout, { kind: "cyberware", itemId: "chipware_socket", budget: "gear" });
    expect(
      canPurchase("complete_package", loadout, {
        kind: "cyberware",
        itemId: "chemical_analyzer",
        budget: "gear",
      }).ok,
    ).toBe(true);
  });

  it("honours maxInstalls on the Cyberaudio Suite", () => {
    const loadout = buy(EMPTY_LOADOUT, {
      kind: "cyberware",
      itemId: "cyberaudio_suite",
      budget: "gear",
    });
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
      canPurchase("complete_package", loadout, {
        kind: "cyberware",
        itemId: "cybereye",
        budget: "gear",
      }).ok,
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
    const loadout = buy(EMPTY_LOADOUT, {
      kind: "cyberware",
      itemId: "light_tattoo",
      budget: "fashion",
    });
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

describe("cart stacks", () => {
  it("merges identical purchases into one stack", () => {
    let loadout = buy(EMPTY_LOADOUT, { kind: "weapon", itemId: "medium_pistol", budget: "gear" });
    loadout = buy(loadout, { kind: "weapon", itemId: "medium_pistol", budget: "gear" });
    const stacks = cartStacks(loadout);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.qty).toBe(2);
    expect(stacks[0]!.cost).toBe(itemCost("weapon", "medium_pistol") * 2);
  });

  it("keeps different variants apart", () => {
    let loadout = buy(EMPTY_LOADOUT, {
      kind: "weapon",
      itemId: "very_heavy_melee",
      budget: "gear",
      variant: "Spiked Bat",
    });
    loadout = buy(loadout, {
      kind: "weapon",
      itemId: "very_heavy_melee",
      budget: "gear",
      variant: "Combat Knife",
    });
    expect(cartStacks(loadout)).toHaveLength(2);
  });

  it("never stacks foundation cyberware installs", () => {
    let loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "cybereye", budget: "gear" });
    loadout = buy(loadout, { kind: "cyberware", itemId: "cybereye", budget: "gear" });
    const stacks = cartStacks(loadout);
    expect(stacks).toHaveLength(2);
    expect(stacks.every((s) => s.stackable)).toBe(false);
  });

  it("adds and removes one unit at a time", () => {
    const loadout = buy(EMPTY_LOADOUT, { kind: "weapon", itemId: "medium_pistol", budget: "gear" });
    const key = cartStacks(loadout)[0]!.key;
    const more = changeQty("complete_package", loadout, key, 1);
    expect(cartStacks(more)[0]!.qty).toBe(2);
    const fewer = changeQty("complete_package", more, key, -1);
    expect(cartStacks(fewer)[0]!.qty).toBe(1);
    expect(cartStacks(changeQty("complete_package", fewer, key, -1))).toHaveLength(0);
  });

  it("blocks adding one more when the budget cannot cover it", () => {
    let loadout = EMPTY_LOADOUT;
    const cost = itemCost("weapon", "medium_pistol");
    const limit = budgetStates("complete_package", loadout).find((b) => b.id === "gear")!.limit;
    const affordable = Math.floor(limit / cost);
    for (let i = 0; i < affordable; i += 1) {
      loadout = buy(loadout, { kind: "weapon", itemId: "medium_pistol", budget: "gear" });
    }
    const key = cartStacks(loadout)[0]!.key;
    expect(canChangeQty("complete_package", loadout, key, 1).ok).toBe(false);
    expect(changeQty("complete_package", loadout, key, 1)).toBe(loadout);
  });

  it("removes a whole stack at once", () => {
    let loadout = buy(EMPTY_LOADOUT, { kind: "weapon", itemId: "medium_pistol", budget: "gear" });
    loadout = buy(loadout, { kind: "weapon", itemId: "medium_pistol", budget: "gear" });
    const key = cartStacks(loadout)[0]!.key;
    expect(removeStack(loadout, key).lines).toHaveLength(0);
  });
});

describe("standalone cyberware stacking", () => {
  it("stacks fashionware installs", () => {
    let loadout = buy(EMPTY_LOADOUT, {
      kind: "cyberware",
      itemId: "light_tattoo",
      budget: "fashion",
    });
    loadout = buy(loadout, { kind: "cyberware", itemId: "light_tattoo", budget: "fashion" });
    const stacks = cartStacks(loadout);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.qty).toBe(2);
    expect(stacks[0]!.stackable).toBe(true);
  });

  it("keeps foundations and their options as separate rows", () => {
    let loadout = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "neural_link", budget: "gear" });
    loadout = buy(loadout, { kind: "cyberware", itemId: "kerenzikov", budget: "gear" });
    const stacks = cartStacks(loadout);
    expect(stacks).toHaveLength(2);
    expect(stacks.every((s) => s.stackable)).toBe(false);
  });

  it("charges the same Humanity and slots whether stacked or not", () => {
    let separate = buy(EMPTY_LOADOUT, { kind: "cyberware", itemId: "biomonitor", budget: "gear" });
    separate = buy(separate, { kind: "cyberware", itemId: "biomonitor", budget: "gear" });
    const key = cartStacks(separate)[0]!.key;
    const stacked = changeQty("complete_package", separate, key, 1);
    expect(cartStacks(stacked)[0]!.qty).toBe(3);
    expect(categorySlotUsage(stacked)["fashionware"]).toBe(3);
    expect(loadoutHumanity(60, stacked).humanityLost).toBe(0);
  });
});
