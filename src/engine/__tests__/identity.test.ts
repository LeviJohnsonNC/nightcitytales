import { describe, expect, it } from "vitest";
import {
  AGE_MAX,
  AGE_MIN,
  ageBand,
  identityLine,
  isSex,
  pronounsFor,
  readIdentity,
  sexFromPronouns,
  validAge,
} from "../identity";

describe("identity", () => {
  it("accepts a whole age inside the range and nothing else", () => {
    expect(validAge(AGE_MIN)).toBe(AGE_MIN);
    expect(validAge(AGE_MAX)).toBe(AGE_MAX);
    expect(validAge("71")).toBe(71);
    expect(validAge(AGE_MIN - 1)).toBeNull();
    expect(validAge(AGE_MAX + 1)).toBeNull();
    expect(validAge(30.5)).toBeNull();
    expect(validAge("")).toBeNull();
    expect(validAge("abc")).toBeNull();
    expect(validAge(null)).toBeNull();
  });

  it("puts every legal age in exactly one band, oldest bands last", () => {
    const seen: string[] = [];
    for (let age = AGE_MIN; age <= AGE_MAX; age += 1) {
      const id = ageBand(age).id;
      if (seen[seen.length - 1] !== id) seen.push(id);
    }
    expect(seen).toEqual(["young", "prime", "middle", "older", "elder"]);
  });

  it("reads a stored identity back, and refuses what is not one", () => {
    expect(readIdentity({ sex: "male", age: 71 })).toEqual({ sex: "male", age: 71 });
    expect(readIdentity({ sex: "other", age: 5 })).toEqual({ sex: null, age: null });
    expect(readIdentity(null)).toEqual({ sex: null, age: null });
  });

  it("says who somebody is on sight, or nothing at all, and never the number", () => {
    for (let age = 16; age <= 90; age += 1) {
      expect(identityLine({ sex: "male", age })).not.toMatch(/\d/);
    }
    expect(identityLine({ sex: "male", age: 71 })).toBe("man, elderly");
    expect(identityLine({ sex: "female", age: 22 })).toBe("woman, young");
    expect(identityLine({ sex: "female", age: null })).toBe("woman");
    expect(identityLine({ sex: null, age: null })).toBeNull();
  });

  it("carries the pronouns over for all three genders, and nothing else", () => {
    expect(pronounsFor("female")).toBe("she/her");
    expect(pronounsFor("male")).toBe("he/him");
    expect(pronounsFor("nonbinary")).toBe("they/them");
    expect(sexFromPronouns("he/him")).toBe("male");
    expect(sexFromPronouns("She / Her")).toBe("female");
    expect(sexFromPronouns("They/Them")).toBe("nonbinary");
    expect(sexFromPronouns("xe/xem")).toBeNull();
    expect(sexFromPronouns("")).toBeNull();
  });

  it("knows a nonbinary character, and writes their pronouns into the line", () => {
    expect(isSex("nonbinary")).toBe(true);
    expect(isSex("other")).toBe(false);
    expect(readIdentity({ sex: "nonbinary", age: 40 })).toEqual({ sex: "nonbinary", age: 40 });
    expect(identityLine({ sex: "nonbinary", age: 40 })).toBe(
      "nonbinary person, they/them, middle-aged",
    );
    expect(identityLine({ sex: "nonbinary", age: null })).toBe("nonbinary person, they/them");
  });

  it("never says a nonbinary character's age as a number either", () => {
    for (let age = 16; age <= 90; age += 1) {
      expect(identityLine({ sex: "nonbinary", age })).not.toMatch(/\d/);
    }
  });
});
