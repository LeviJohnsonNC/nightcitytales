import { describe, expect, it } from "vitest";
import { npcsNamedIn, splitNpcMentions } from "../npcMentions";

describe("npcMentions", () => {
  it("cuts a passage into plain runs and the names in it", () => {
    expect(splitNpcMentions("Then Ilsa Bräun smiled.")).toEqual([
      "Then ",
      { match: "Ilsa Bräun" },
      " smiled.",
    ]);
  });

  it("prefers the full name to a nickname", () => {
    const named = npcsNamedIn('Marcus "Tally" Oyelaran waved. Tally waved again.');
    expect(named.map((n) => n.id)).toEqual(["marcus-tally-oyelaran"]);
  });

  it("finds nobody in a passage with nobody named", () => {
    expect(npcsNamedIn("The rain has stopped.")).toEqual([]);
    expect(splitNpcMentions("")).toEqual([]);
  });
});
