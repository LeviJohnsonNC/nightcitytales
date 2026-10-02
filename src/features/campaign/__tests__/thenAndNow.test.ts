import { describe, expect, it } from "vitest";
import { getArmor, getCyberware, getWeapon, roleAbilityOf } from "@/engine";
import type {
  CampaignCyberware,
  CampaignEvent,
  CampaignInventoryItem,
  CampaignNpc,
  CampaignVitals,
  FullCharacter,
} from "@/lib/backend";
import { thenAndNow } from "../thenAndNow";

const WEAPON = "heavy_pistol";
const ARMOR = "kevlar";

const character = {
  character: { id: "ch", name: "V", role: "solo" },
  skills: [],
  stats: { humanity_current: 60, humanity_max: 60 },
  gear: [
    { item_id: WEAPON, slot: "weapon" },
    { item_id: ARMOR, slot: "body" },
    { item_id: "basic_ammo", slot: "ammunition" },
  ],
  cyberware: [{ item_id: "cybereye" }],
  finance: { improvement_points: 0, home_district_key: null },
} as unknown as FullCharacter;

const vitals = (humanity: number) => ({ humanity_current: humanity }) as CampaignVitals;
const inv = (kind: string, item_id: string) => ({ kind, item_id }) as CampaignInventoryItem;
const chrome = (item_id: string) => ({ item_id }) as CampaignCyberware;
const npc = (name: string, role: string, disposition: number, status = "active") =>
  ({
    name,
    npc_id: name.toLowerCase(),
    disposition,
    status,
    data: { role },
  }) as unknown as CampaignNpc;

let seq = 0;
const event = (type: string, data: unknown) => {
  seq += 1;
  return { id: `e${seq}`, seq, type, data, summary: null } as unknown as CampaignEvent;
};

const dayOne = {
  day: 1,
  character,
  vitals: vitals(60),
  inventory: [inv("weapon", WEAPON), inv("armor", ARMOR), inv("ammunition", "basic_ammo")],
  cyberware: [chrome("cybereye")],
  npcs: [npc("Kiro", "friend", 2), npc("Razor", "enemy", -2)],
  standings: [],
  events: [],
};

describe("then and now", () => {
  it("has nothing to say on day one", () => {
    expect(thenAndNow(dayOne)).toEqual([]);
  });

  it("joins a Skill's raises into one line, first Level to last", () => {
    const sections = thenAndNow({
      ...dayOne,
      events: [
        event("skill_raised", {
          skill_id: "handgun",
          specialization: null,
          from_level: 4,
          to_level: 5,
          cost: 100,
        }),
        event("skill_raised", {
          skill_id: "handgun",
          specialization: null,
          from_level: 5,
          to_level: 6,
          cost: 120,
        }),
        event("skill_raised", {
          skill_id: "brawling",
          specialization: null,
          from_level: 0,
          to_level: 1,
          cost: 20,
        }),
        event("role_rank_raised", {
          ability_id: "combat_awareness",
          from_rank: 4,
          to_rank: 5,
          cost: 300,
        }),
        event("ip_awarded", { award: { ip: 40, source: "group" } }),
        event("ip_awarded", { award: { ip: 20, source: "explorer" }, kind: "life", day: 9 }),
      ],
    });
    expect(sections[0]?.lines.map((l) => l.text)).toEqual([
      `${roleAbilityOf("solo")!.abilityName} Rank 4 → 5`,
      "Handgun 4 → 6",
      "Brawling: learned, now 1",
      "60 Improvement Points earned",
    ]);
  });

  it("sets the chrome beside what it cost", () => {
    const sections = thenAndNow({
      ...dayOne,
      vitals: vitals(52),
      cyberware: [chrome("cybereye"), chrome("neural_link")],
    });
    const lines = sections.find((s) => s.title.startsWith("Chrome"))!.lines;
    expect(lines).toEqual([
      { text: `${getCyberware("neural_link").name} installed`, tone: "good" },
      { text: "Humanity 60 → 52", tone: "bad" },
    ]);
  });

  it("counts kit as weapons and armor, gained and lost, and ignores the ammunition", () => {
    const sections = thenAndNow({
      ...dayOne,
      inventory: [inv("weapon", WEAPON), inv("weapon", WEAPON), inv("ammunition", "basic_ammo")],
    });
    expect(sections.find((s) => s.title === "What you carry")?.lines).toEqual([
      { text: `${getWeapon(WEAPON).name}, new`, tone: "good" },
      { text: `${getArmor(ARMOR).name}, gone`, tone: "bad" },
    ]);
  });

  it("words people against where they began, and leaves out whoever has not moved", () => {
    const sections = thenAndNow({
      ...dayOne,
      npcs: [
        npc("Kiro", "friend", -1),
        npc("Razor", "enemy", -2),
        npc("Juno", "old_flame", 0, "dead"),
      ],
    });
    expect(sections.find((s) => s.title === "Who you know")?.lines).toEqual([
      { text: "Kiro: close → cold", tone: "bad" },
      { text: "Juno: dead", tone: "bad" },
    ]);
  });

  it("measures every faction from no opinion at all", () => {
    const sections = thenAndNow({
      ...dayOne,
      standings: [
        { factionId: "tyger_claws", standing: -5 },
        { factionId: "ncpd", standing: 2 },
      ],
    });
    expect(sections.find((s) => s.title === "Who knows your name")?.lines).toEqual([
      { text: "Tyger Claws: unknown → hostile", tone: "bad" },
      { text: "NCPD: unknown → useful", tone: "good" },
    ]);
  });
});
