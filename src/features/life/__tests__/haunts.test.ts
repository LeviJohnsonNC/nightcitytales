import { describe, expect, it } from "vitest";
import { DEFAULT_START, districtOfPlace } from "@/engine";
import type { Campaign, CampaignNpc } from "@/lib/backend";
import { hauntPeople } from "../lifeModel";

/**
 * Where the recurring cast keep their bars.
 *
 * `hauntsFor` puts people in the part of town the character lives in, and says
 * why in its own header: "a cast you can only meet by crossing the city is a
 * cast you never meet." It was being handed `DEFAULT_START` — a constant, not
 * the character's address — so every campaign's cast kept their bars in Little
 * Europe however far away the character had actually moved in.
 */
const campaign = { id: "campaign-1" } as unknown as Campaign;

/** A campaign_npcs row of the shape castSeeding writes: role and dossier in `data`. */
function npcRow(npcId: string, name: string, role: string): CampaignNpc {
  return {
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
    },
  } as unknown as CampaignNpc;
}

const npcs = [npcRow("fixer-1", "Sable", "fixer"), npcRow("ripper-1", "Needles", "ripperdoc")];

/** Every district the cast can be found in, for one home. */
function districtsFor(homeDistrictKey: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const person of hauntPeople(npcs, campaign, homeDistrictKey)) {
    for (const placeKey of person.haunts) {
      const district = districtOfPlace(placeKey);
      if (district) out.add(district.key);
    }
  }
  return out;
}

describe("where the cast are", () => {
  it("keeps them in the district the character actually lives in", () => {
    // Not everybody, necessarily: `hauntsFor` widens the search to the whole
    // city for a role whose ground the home district simply does not have —
    // Rancho Coronado has no ripperdoc, and somebody with an address across
    // town beats somebody with no address at all. What must be true is that
    // home is where the cast are found whenever home can hold them.
    for (const home of ["rancho_coronado", "watson_development", "the_glen"]) {
      const found = districtsFor(home);
      expect(found, `nobody is anywhere for a character living in ${home}`).toContain(home);
    }
  });

  it("puts everybody at home when the home district can hold them all", () => {
    // Watson Development has thirteen locations and ground for both of these.
    expect([...districtsFor("watson_development")]).toEqual(["watson_development"]);
  });

  it("no longer parks everybody in Little Europe wherever the character lives", () => {
    // The bug, stated as a test: this used to hold for every home district.
    expect([...districtsFor("rancho_coronado")]).not.toContain(DEFAULT_START);
  });

  it("falls back to the default start rather than leaving somebody nowhere", () => {
    // A character saved before the address columns existed has no home district.
    for (const missing of [null, undefined, ""]) {
      const people = hauntPeople(npcs, campaign, missing);
      expect(people.length).toBe(npcs.length);
      expect(people.every((p) => p.haunts.length > 0)).toBe(true);
    }
  });

  it("still draws the same haunts for the same campaign", () => {
    // Derived rather than stored, so this has to be stable across reloads.
    expect(hauntPeople(npcs, campaign, "kabuki")).toEqual(hauntPeople(npcs, campaign, "kabuki"));
  });
});
