/**
 * What a Role actually hands you on day one.
 *
 * The character creator sold every Role with 2,345 characters of rank table.
 * Nobody has ever chosen a class because of a rank table: what a player wants
 * to know is what they can DO on the first night, and the answer to that had
 * been living in nine other engine modules with no way to ask it.
 *
 * So this module asks them. Every number below is a CALL, not a sentence —
 * `combatAwarenessPool`, `backupTierFor`, `motorpoolFor`, `planFabrication`,
 * `priceCategoryContext`, `hagglePercent`, `credibilityFor`, `storyImpactFor`,
 * the same functions play itself runs on. That is the whole point of putting it
 * here rather than in a copy file: a promise the creator makes has to be a
 * promise the game keeps, and prose that was true once is the exact bug this
 * codebase has been paying off for weeks.
 *
 * The VOICE is the wizard's own (see copy.ts and lib/prose-style.ts): second
 * person, present tense, no rules quoted at somebody who has not chosen yet.
 * The printed rules are still one click away; they are simply no longer the
 * door.
 *
 * Pure TypeScript: a Role id and a Rank in, a short list of true things out.
 */
import {
  CHARISMATIC_AUDIENCES,
  COMBAT_AWARENESS_OPTIONS,
  MEDICAL_DRUGS,
  MEDICINE_SPECIALTIES,
  backupTierFor,
  charismaticFavor,
  combatAwarenessPool,
  credibilityFor,
  makerSpecialtyPool,
  teamMemberSlots,
} from "./roleAbility";
import { hagglePercent } from "./haggle";
import { motorpoolFor } from "./vehicles";
import { planFabrication } from "./fabrication";
import { PRICE_CATEGORY_LADDER, priceCategoryContext } from "./priceCategory";
import { storyImpactFor } from "./storyImpact";
import { FACTION_IDS } from "./factions";

/** One concrete thing this Role has that the others do not. */
export type RoleFact = {
  /** The short name of the thing: "A Roadbike outside". */
  label: string;
  /** What it means on the first night, in one sentence. */
  detail: string;
};

export type RoleOpening = {
  roleId: string;
  /** The promise, in the player's own second person. */
  headline: string;
  facts: RoleFact[];
  /**
   * True when the Role Ability is not modelled yet.
   *
   * Saying so is better than selling it as an equal and disappointing somebody
   * forty minutes into a campaign. There is exactly one, and it is on the
   * roadmap by name.
   */
  unbuilt: boolean;
};

/** The highest price category a Fixer of this Rank can always source. */
function reachOf(rank: number): string | null {
  let best: string | null = null;
  for (const category of PRICE_CATEGORY_LADDER) {
    const needed = priceCategoryContext(category)?.fixerRank;
    if (typeof needed === "number" && rank >= needed) best = category;
  }
  return best;
}

/** A worked example of the bench, priced off the real catalog. */
function benchExample(): RoleFact | null {
  const plan = planFabrication("weapon", "very_heavy_melee");
  if (!plan) return null;
  return {
    label: "A bench, and the patience for it",
    detail:
      `${plan.materialsCost}eb of ${plan.materialsCategory} parts and ${plan.timeLabel} ` +
      `at the bench becomes a ${plan.itemName} worth ${plan.itemPrice}eb. ` +
      "Anything the city sells, you can make instead.",
  };
}

const OPENINGS: Record<string, (rank: number) => RoleOpening> = {
  rockerboy: (rank) => {
    const single = CHARISMATIC_AUDIENCES.find((a) => a.id === "single");
    const huge = CHARISMATIC_AUDIENCES.find((a) => a.id === "huge_group");
    const favour = charismaticFavor(rank, "single");
    return {
      roleId: "rockerboy",
      headline: "You can make the timid brave and the comfortable afraid.",
      facts: [
        {
          label: "Charismatic Impact",
          detail:
            `Your Rank and a d10 against the size of the crowd — ${single?.dv ?? 8} for one ` +
            `person, ${huge?.dv ?? 12} for a mob. No STAT, no Skill. The Rank is the whole roll.`,
        },
        ...(favour
          ? [
              {
                label: "What winning them buys",
                detail: `Win one person over, and what you can ask of them is ${favour}.`,
              },
            ]
          : []),
        {
          label: "Doors that open on your name",
          detail: "Being known is its own key, and the city keeps a list of who moved it.",
        },
      ],
      unbuilt: false,
    };
  },

  solo: (rank) => ({
    roleId: "solo",
    headline: "The fight is usually over before the other side knows it started.",
    facts: [
      {
        label: `${combatAwarenessPool(rank)} points, divided before the shooting`,
        detail:
          `Spread them across ${COMBAT_AWARENESS_OPTIONS.length} options — hit harder, get hit ` +
          "softer, go first, stop fumbling — and re-divide whenever you are not in a fight.",
      },
      {
        label: "The first shot of every Round is yours",
        detail:
          "Spot Weakness rides on the first attack that lands; Damage Deflection takes the edge " +
          "off the first that lands on you.",
      },
      {
        label: "You read a room for exits",
        detail: "Threat Detection is the difference between an ambush and a fight you chose.",
      },
    ],
    unbuilt: false,
  }),

  netrunner: () => ({
    roleId: "netrunner",
    headline: "Every wall in this city has something running inside it.",
    facts: [
      {
        label: "Not built yet",
        detail:
          "The NET is its own game and it is getting its own update. Everything else about a " +
          "Netrunner works; jacking in does not, yet. Pick another Role for now.",
      },
    ],
    unbuilt: true,
  }),

  tech: (rank) => ({
    roleId: "tech",
    headline: "If the city will not sell it to you, you make it yourself.",
    facts: [
      ...(benchExample() ? [benchExample()!] : []),
      {
        label: `${makerSpecialtyPool(rank)} Specialty ranks`,
        detail:
          "Two for every Rank of Maker. Field Expertise rides on every Tech Check you make; " +
          "Fabrication Expertise is what gets the thing built.",
      },
      {
        label: "A failure costs the week, not the parts",
        detail: "They are still on the bench in the morning. Try again.",
      },
    ],
    unbuilt: false,
  }),

  medtech: (rank) => {
    const speedheal = MEDICAL_DRUGS.find((d) => d.id === "speedheal");
    const surgery = MEDICINE_SPECIALTIES.find((s) => s.id === "surgery");
    return {
      roleId: "medtech",
      headline: "You are the reason the crew comes home.",
      facts: [
        {
          label: `${Math.max(0, Math.trunc(rank))} Specialty points`,
          detail:
            `Surgery buys ${surgery?.skillPerPoint ?? 2} Skill Levels a point. Pharmaceuticals ` +
            "buys a drug you can make yourself, and Night City does not sell the good ones.",
        },
        ...(speedheal
          ? [
              {
                label: "Your own pharmacy",
                detail:
                  `You synthesize your own ${speedheal.name}, and a dose puts BODY + WILL back ` +
                  "on somebody who is still standing. Night City does not sell the good ones.",
              },
            ]
          : []),
        {
          label: "Less time on your back",
          detail:
            "You dress your own wounds better than anyone, so you are back on the street while " +
            "the rest of the crew is still healing.",
        },
      ],
      unbuilt: false,
    };
  },

  media: (rank) => {
    const band = credibilityFor(rank);
    const impact = storyImpactFor(rank);
    return {
      roleId: "media",
      headline: "You can cost a corporation more than a bullet ever will.",
      facts: [
        {
          label: "A story that actually lands",
          detail:
            impact && band
              ? `Prove it and print it, and whoever it is about loses ${impact.clockSegments} ` +
                `segment${impact.clockSegments === 1 ? "" : "s"} of whatever they were building ` +
                `against you. At this Rank that reads as: ${band.impact}.`
              : "Prove it and print it, and it costs the people it is about.",
        },
        {
          label: `${FACTION_IDS.length} organisations run this city`,
          detail: "You can cost any one of them, in print. They will work out who wrote it.",
        },
        {
          label: "Evidence is what you dug up",
          detail:
            "Not what you claim. What you actually found out since your last piece is what " +
            "makes the city believe this one.",
        },
      ],
      unbuilt: false,
    };
  },

  exec: (rank) => ({
    roleId: "exec",
    headline: "You fight with a budget and other people's hands.",
    facts: [
      {
        label:
          teamMemberSlots(rank) > 0
            ? `${teamMemberSlots(rank)} Team Member${teamMemberSlots(rank) === 1 ? "" : "s"}`
            : "A team, as your Rank grows",
        detail:
          "People who do the thing you would otherwise do yourself — and who have their own " +
          "opinion about being asked.",
      },
      {
        label: "The company houses you",
        detail: "Rent is somebody else's problem, which in this city is most of a salary.",
      },
      {
        label: "A name that still opens things",
        detail: "It does not open everything, and it does not open it twice.",
      },
    ],
    unbuilt: false,
  }),

  lawman: (rank) => {
    const tier = backupTierFor(rank);
    return {
      roleId: "lawman",
      headline: "You hold a line in a city that eats the people who try.",
      facts: [
        {
          label: tier ? `${tier.count} ${tier.name.toLowerCase()}, on the radio` : "Backup",
          detail: tier
            ? `Roll under your Rank and they come. ${tier.note} They arrive armed and they ` +
              "shoot the people shooting at you."
            : "Call it in and armed people come.",
        },
        {
          label: "The system, from the inside",
          detail: "A name, a plate, a face — you can run any of them against what the file holds.",
        },
        {
          label: "People who fear a report more than you",
          detail: "Most of this city has more to lose from paperwork than from a fight.",
        },
      ],
      unbuilt: false,
    };
  },

  fixer: (rank) => {
    const reach = reachOf(rank);
    return {
      roleId: "fixer",
      headline: "Whatever they need, you are three calls away from it.",
      facts: [
        {
          label: reach ? `${reach} gear, always` : "Reach",
          detail: reach
            ? `Anything up to ${reach} you can always source. Nobody rolls to see whether ` +
              "they have it in tonight."
            : "You can source what other people have to hope for.",
        },
        {
          label: `${hagglePercent({ isFixer: true, operatorRank: rank })}% off, if you argue`,
          detail:
            "Your Rank rides on the deal itself, so the first number a seller says is never the " +
            "one you pay.",
        },
        {
          label: "The number everyone has saved",
          detail: "Work owed to you is a currency, and you are the only Role that banks it.",
        },
      ],
      unbuilt: false,
    };
  },

  nomad: (rank) => {
    const pool = motorpoolFor(rank);
    const first = pool[0];
    const air = pool.find((v) => v.kind === "air");
    return {
      roleId: "nomad",
      headline: "The road is the one thing Night City cannot take off you.",
      facts: [
        {
          label: first ? `A ${first.name} outside` : "The Family Motorpool",
          detail: first
            ? `Yours, waiting where you left it. Anywhere in Night City faster than a cab, and ` +
              "you never stand on a corner hoping one comes."
            : "The Family keep the keys, and your Rank says which ones you get.",
        },
        ...(pool.length > 1
          ? [
              {
                label: `${pool.length} machines you may call for`,
                detail:
                  `${pool.map((v) => v.name).join(", ")}. One out at a time; the Family swap it ` +
                  `over the next morning` +
                  (air ? `, and the ${air.name.toLowerCase()} does not use the bridges.` : "."),
              },
            ]
          : []),
        {
          label: "You always know the way out",
          detail: "Which is the difference between a bad night and a story you get to tell.",
        },
      ],
      unbuilt: false,
    };
  },
};

/**
 * What this Role hands a character on day one, or null for a Role the data does
 * not know. Every figure in it is computed; nothing is transcribed.
 */
export function roleOpening(roleId: string | null | undefined, rank: number): RoleOpening | null {
  if (!roleId) return null;
  const build = OPENINGS[roleId];
  return build ? build(Math.max(0, Math.trunc(rank))) : null;
}

/** Every Role id this module can speak for, for the tests that hold it complete. */
export const ROLE_OPENING_IDS: string[] = Object.keys(OPENINGS);
