import { describe, expect, it } from "vitest";
import { seededRng } from "../dice";
import {
  chooseRoleLifepathEntry,
  getRoleLifepathOrder,
  getRoleLifepathTable,
  isRoleTableRevealed,
  pruneRoleLifepathAnswers,
  rollRoleLifepathTable,
  visibleRoleLifepathTables,
} from "../roleLifepath";

describe("role lifepath", () => {
  it("iterates _order, not the printed order", () => {
    const order = getRoleLifepathOrder("rockerboy");
    expect(order.indexOf("were_you_once_in_a_group")).toBeLessThan(
      order.indexOf("why_did_you_leave"),
    );
  });

  it("reads the die per table instead of assuming d10", () => {
    expect(getRoleLifepathTable("rockerboy", "what_kind_of_rockerboy_are_you").die).toBe("1d10");
    expect(getRoleLifepathTable("rockerboy", "where_do_you_perform").die).toBe("1d6");
    expect(getRoleLifepathTable("nomad", "is_your_pack_based_on_land_air_or_sea").die).toBeNull();
  });

  it("rolls within the table's own die", () => {
    const rng = seededRng(7);
    for (let i = 0; i < 20; i++) {
      const { entry } = rollRoleLifepathTable("rockerboy", "where_do_you_perform", rng);
      expect(entry.roll).toBeGreaterThanOrEqual(1);
      expect(entry.roll).toBeLessThanOrEqual(6);
      expect(entry.method).toBe("rolled");
    }
  });

  it("hides a conditional table until its gate reveals it", () => {
    const table = getRoleLifepathTable("nomad", "if_on_land_what_do_they_do");
    expect(isRoleTableRevealed(table, {})).toBe(false);
    const air = chooseRoleLifepathEntry("nomad", "is_your_pack_based_on_land_air_or_sea", "Air");
    expect(isRoleTableRevealed(table, { [air.tableId]: air })).toBe(false);
    const land = chooseRoleLifepathEntry("nomad", "is_your_pack_based_on_land_air_or_sea", "Land");
    expect(isRoleTableRevealed(table, { [land.tableId]: land })).toBe(true);
    expect(visibleRoleLifepathTables("nomad", { [land.tableId]: land }).map((t) => t.id)).toContain(
      "if_on_land_what_do_they_do",
    );
  });

  it("clears a dependent answer when the gate answer changes", () => {
    const land = chooseRoleLifepathEntry("nomad", "is_your_pack_based_on_land_air_or_sea", "Land");
    const branch = rollRoleLifepathTable("nomad", "if_on_land_what_do_they_do", seededRng(3)).entry;
    const sea = chooseRoleLifepathEntry("nomad", "is_your_pack_based_on_land_air_or_sea", "Sea");
    const pruned = pruneRoleLifepathAnswers("nomad", {
      [sea.tableId]: sea,
      [branch.tableId]: branch,
      ...(land ? {} : {}),
    });
    expect(pruned["if_on_land_what_do_they_do"]).toBeUndefined();
  });

  it("records choices with a null roll", () => {
    const entry = chooseRoleLifepathEntry(
      "solo",
      "got_a_partner_or_do_you_work_alone",
      "Have a Partner",
    );
    expect(entry).toMatchObject({ method: "chosen", roll: null });
  });
});
