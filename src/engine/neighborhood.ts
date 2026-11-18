import rules from "@/data/rules/stackside.json";
import { advanceClock } from "./clock";
import { woundStateFor, type GameClock } from "./campaign";

export const NEIGHBORHOOD_FLAG = "old_japantown_neighborhood";
export const CLINIC_PLACE = "h5";
const steps = {
  counterLead: ["ticket", "medtech", "fixer", "nomad"],
  counterResult: ["bowls", "kit", "split"],
  lanternLead: ["listen", "rockerboy", "tech", "media", "netrunner", "lawman", "exec", "solo"],
  lanternResult: ["benefit", "door"],
  keys: ["keys"],
  staff: ["staff"],
  equipment: ["collect", "buy", "unload"],
  lease: ["residents", "kimen"],
} as const;
type Step = keyof typeof steps;
export type Neighborhood = { [K in Step]?: (typeof steps)[K][number] } & { careDay?: number };

/** Old campaigns have no flag. Refuse unrecognised saves rather than reset someone's block. */
export function readNeighborhood(flags: readonly { flag: string; value: unknown }[]): Neighborhood {
  const row = flags.find((f) => f.flag === NEIGHBORHOOD_FLAG);
  if (!row) return {};
  const raw = row.value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Unreadable neighborhood record.");
  for (const [key, value] of Object.entries(raw)) {
    if (
      key === "careDay"
        ? Number.isSafeInteger(value) && value >= 0
        : Object.hasOwn(steps, key) && (steps[key as Step] as readonly unknown[]).includes(value)
    )
      continue;
    throw new Error("Unrecognized neighborhood record. Reload the latest game.");
  }
  return raw as Neighborhood;
}

export type NeighborhoodContext = {
  place: string | null;
  role: string;
  clock: GameClock;
  cash: number;
  hp: number;
  maxHp: number;
  serious: number;
};

type Choice = {
  id: string;
  label: string;
  minutes: number;
  receipt: string;
  cost?: number;
  heal?: number;
  disabled?: string;
};
type Moment = { title: string; text: string; choices: Choice[] };

const leads = {
  ticket: [
    "Read the delivery ticket",
    "Under the grease pencil you find two addresses. The last cart can make one more stop.",
  ],
  medtech: [
    "Medtech · check the cold packs",
    "Only the dressing packs need the cooler. Emi finds room for those under the broth ice.",
  ],
  fixer: [
    "Fixer · call the dispatcher",
    "You recognize the dispatch mark. One call gets you the driver's last stop and space on her return trip.",
  ],
  nomad: [
    "Nomad · catch the returning hauler",
    "You recognize the wheel chalk. The driver is circling back empty and owes the loading crew a ride.",
  ],
} as const;
const counterEnd = {
  bowls:
    "The late shift eats for free. Emi leaves a blue bowl on the sill so the night crew knows to come in.",
  kit: "Emi sends the dressings to Suzuki’s. A clinic kit waits under the counter in your name.",
  split:
    "The bowls reach the night shift and Suzuki signs for the dressings. The blue bowl is on the sill, and a clinic kit waits in your name.",
} as const;
const lanternEnd = {
  benefit:
    "The room sings the chorus twice. The bar puts the night’s takings in the residents’ lease tin.",
  door: "Yori writes tenants’ names on the back of the set list. She volunteers to run the clinic door when it opens.",
} as const;

const lanternLeads = {
  listen: [
    "Sit with Yori and listen",
    "Yori taps time on the bar. The singer carries that rhythm down the room until even the back row can hear.",
  ],
  rockerboy: [
    "Rockerboy · take the set unplugged",
    "You take a stool beside the singer. By the second line, the back row has become the choir.",
  ],
  tech: [
    "Tech · borrow the kitchen speaker",
    "The cable is fine. The cabinet is gone. You borrow the order speaker from the kitchen and the singer finishes the verse over the pass.",
  ],
  media: [
    "Media · lend the singer your field mic",
    "Your field mic has its own little monitor. Yori holds it up. For once you leave the recorder off.",
  ],
  netrunner: [
    "Netrunner · put the set on the house network",
    "The owner gives you the guest channel. A dozen agents play the same thin voice, half a beat apart. The room joins in on time.",
  ],
  lawman: [
    "Lawman · speak to the noise patrol",
    "The patrol outside wants the door shut. You get them to give the singer one verse on the step. A crowd gathers along the rail.",
  ],
  exec: [
    "Exec · borrow the hotel’s meeting speaker",
    "The Highcourt night porter recognizes your meeting badge. Yori comes back with a speaker and a promise to return it before breakfast.",
  ],
  solo: [
    "Solo · make room by the door",
    "From the back you can see who is blocking the doorway. You get two regulars to move their stools. The quietest voice in the room finally carries outside.",
  ],
} as const;

function approaches<T extends string>(
  ids: readonly T[],
  common: T,
  role: string,
  lines: Record<T, readonly [string, string]>,
): Choice[] {
  return ids
    .filter((id) => id === common || id === role)
    .map((id) => ({
      id,
      label: lines[id][0],
      receipt: lines[id][1],
      minutes: id === common ? rules.lookMinutes : rules.specialistMinutes,
    }));
}

function counter(s: Neighborhood, role: string): Moment {
  const title = "One cart, two addresses";
  if (s.counterResult) {
    const marker =
      s.counterResult !== "kit"
        ? "The blue bowl is on the sill. A welder from the late shift waves you over."
        : "";
    const delivery =
      s.counterResult !== "bowls"
        ? s.equipment
          ? "Emi keeps the clinic’s next delivery slip beside the till."
          : "Suzuki is holding the clinic kit under your name."
        : "";
    return { title, text: [marker, delivery].filter(Boolean).join(" "), choices: [] };
  }
  if (!s.counterLead) {
    return {
      title,
      text: "Nakamura works the pot. His delivery runner Emi has six bowls going cold and a crate of dressings sweating on the tile. Both delivery slips say Nakamura’s. The driver is pulling down the shutter.",
      choices: approaches(steps.counterLead, "ticket", role, leads),
    };
  }
  const choices: Choice[] = [
    {
      id: "bowls",
      label: "Send supper to the late shift",
      minutes: rules.sceneMinutes,
      receipt: counterEnd.bowls,
    },
    {
      id: "kit",
      label: "Reserve the dressings for Stackside",
      minutes: rules.sceneMinutes,
      receipt: s.equipment
        ? "Emi labels the dressings for Nao’s next shift. Stackside has a standing delivery from the counter."
        : counterEnd.kit,
    },
  ];
  if (s.counterLead !== "ticket")
    choices.push({
      id: "split",
      label: "Use your arrangement to deliver both",
      minutes: rules.sceneMinutes,
      receipt: s.equipment
        ? "The night shift gets its bowls. Emi adds the clinic to the delivery slate for Nao’s next shift."
        : counterEnd.split,
    });
  return { title, text: leads[s.counterLead][1], choices };
}

function lantern(s: Neighborhood, role: string): Moment {
  const title = "Last set at the Lantern";
  if (s.lanternResult)
    return {
      title,
      text:
        s.lanternResult === "benefit"
          ? s.lease
            ? "A photo of Stackside’s opening sits beside the collection tin. The regulars still put their change in."
            : "The lease tin hangs behind the bar. Yori chalked the night’s total on the lid."
          : s.lease
            ? "The set list is taped behind the bar. Beside Yori’s name someone has written ‘on the door at Stackside’."
            : "Yori keeps the set list in her coat pocket. She’s waiting for word that Stackside has its keys.",
      choices: [],
    };
  if (!s.lanternLead)
    return {
      title,
      text: "The amp dies halfway through the tenants’ benefit. The singer keeps moving her mouth. Yori, who pulled a double to get here, still has her coat on.",
      choices: approaches(steps.lanternLead, "listen", role, lanternLeads),
    };
  return {
    title,
    text: lanternLeads[s.lanternLead][1],
    choices: [
      {
        id: "benefit",
        label: "Pass the lease tin",
        minutes: rules.sceneMinutes,
        receipt: s.lease
          ? "The regulars fill the tin for Stackside’s next month."
          : lanternEnd.benefit,
      },
      {
        id: "door",
        label: "Give Yori the floor",
        minutes: rules.sceneMinutes,
        receipt: s.lease
          ? "Yori takes her coat and heads for Stackside. From now on she runs the door."
          : lanternEnd.door,
      },
    ],
  };
}

export function clinicDestination(s: Neighborhood): { place: string; label: string } {
  if (!s.keys) return { place: CLINIC_PLACE, label: "Read the Stackside Clinic notice" };
  if (!s.staff) return { place: "h1", label: "Meet Nao after her shift" };
  if (!s.equipment) return { place: "h4", label: "Pick up the clinic kit" };
  return {
    place: CLINIC_PLACE,
    label: s.lease ? "Visit Stackside Clinic" : "Sign the clinic lease",
  };
}

export function clinicDescription(s: Neighborhood): string {
  if (!s.keys)
    return "Behind a steel shutter at The Precipice sits an empty first-aid room. A key hangs from the tenants’ noticeboard. Someone has pencilled in ‘Ask Nao at Crisis Medical.’";
  if (!s.staff)
    return "You have the key. Nao Kanda, a Medtech at Crisis Medical Center, used to work this room.";
  if (!s.equipment)
    return "Nao has signed on. Mrs. Suzuki has the last field kit on this block at her bodega.";
  if (!s.lease)
    return "The kit is unpacked. The tenants can buy the lease and keep one line for care. The Kimen-Gumi will cover the rent if Nao puts their patients first.";
  const desk =
    s.lanternResult === "door"
      ? "Yori keeps the door and knows every tenant by name."
      : "Nao keeps a handwritten list by the door.";
  return s.lease === "residents"
    ? `Nao Kanda runs Stackside for the residents. The next cot goes to whoever came in first. ${desk}`
    : `Nao Kanda runs Stackside. The Kimen-Gumi paid for the lease and their patients get the first cot. ${desk}`;
}

export function neighborhoodMoment(s: Neighborhood, ctx: NeighborhoodContext): Moment | null {
  if (ctx.place === "h8") return counter(s, ctx.role);
  if (ctx.place === "h7") return lantern(s, ctx.role);
  const next = clinicDestination(s);
  if (ctx.place !== next.place && ctx.place !== CLINIC_PLACE) return null;
  const choices: Choice[] = [];
  if (ctx.place === next.place) {
    if (!s.keys)
      choices.push({
        id: "keys",
        label: "Take the key",
        minutes: rules.volunteerMinutes,
        receipt: "You took the key to Stackside. Nao’s shift ends at Crisis Medical Center.",
      });
    else if (!s.staff)
      choices.push({
        id: "staff",
        label: "Offer Nao a set of keys",
        minutes: rules.recruitMinutes,
        receipt: "Nao takes the spare key. “Bring me Suzuki’s kit and I’ll take the first shift.”",
      });
    else if (!s.equipment) {
      if (s.counterResult === "kit" || s.counterResult === "split")
        choices.push({
          id: "collect",
          label: "Call in Emi’s delivery",
          minutes: rules.pickupMinutes,
          receipt:
            "Suzuki crosses your name off the delivery slip. Emi’s dressings and a field kit go to Stackside.",
        });
      choices.push(
        {
          id: "buy",
          label: "Buy the field kit",
          cost: rules.kitPrice,
          minutes: rules.pickupMinutes,
          receipt: "Suzuki wraps the kit in yesterday’s paper. Nao lays it out at Stackside.",
        },
        {
          id: "unload",
          label: "Unload the van in trade",
          minutes: rules.barterMinutes,
          receipt:
            "You work the loading bay until the van is empty. Suzuki hands over the field kit.",
        },
      );
    } else if (!s.lease)
      choices.push(
        {
          id: "residents",
          label: "Sign the residents’ lease",
          cost: s.lanternResult === "benefit" ? rules.benefitLeasePrice : rules.leasePrice,
          minutes: rules.openingMinutes,
          receipt:
            "The tenants sign. Nao turns on the clinic cross. Everyone joins the same line for care.",
        },
        {
          id: "kimen",
          label: "Let the Kimen-Gumi cover the lease",
          minutes: rules.openingMinutes,
          receipt:
            "The Kimen-Gumi cover the rent. Nao lights the clinic cross. Their people get the first cot on every shift.",
        },
      );
    else {
      const heal = Math.max(0, Math.min(rules.careHp, ctx.maxHp - ctx.hp));
      const disabled =
        ctx.hp <= 0
          ? "Emergency care required."
          : !heal
            ? "You’re at full health."
            : s.careDay === ctx.clock.day
              ? "Nao has treated you today."
              : "";
      choices.push({
        id: "care",
        label: "See Nao for treatment",
        minutes: s.lease === "kimen" ? rules.gangCareMinutes : rules.careMinutes,
        heal,
        receipt: `${s.lease === "kimen" ? "You wait while Nao sees the Kimen-Gumi’s patient first." : "Nao calls you in from the tenants’ bench."} You recover ${heal} HP.`,
        ...(disabled ? { disabled } : {}),
      });
    }
  }
  for (const choice of choices)
    if ((choice.cost ?? 0) > ctx.cash) choice.disabled = "You need more eurobucks.";
  const text =
    ctx.place === "h1"
      ? "Nao Kanda is peeling the tape off her name badge after a double. She recognizes the key before you can tell her where you found it. “Does that room still have a sink?”"
      : ctx.place === "h4"
        ? "Suzuki sets the sealed kit on her scale. Pay the sticker, take a turn in the loading bay, or show her a delivery slip from Emi."
        : clinicDescription(s);
  return { title: "Stackside Clinic", text, choices };
}

export function planNeighborhood(s: Neighborhood, ctx: NeighborhoodContext, id: string) {
  const choice = neighborhoodMoment(s, ctx)?.choices.find((c) => c.id === id);
  if (!choice || choice.disabled)
    throw new Error(choice?.disabled ?? "That opportunity has changed.");
  const clock = advanceClock(ctx.clock, choice.minutes);
  const step = Object.entries(steps).find(([, ids]) =>
    (ids as readonly string[]).includes(id),
  )?.[0];
  if (!step && id !== "care") throw new Error("Missing neighborhood step.");
  const patch = step ? { [step]: id } : { careDay: clock.day };
  return {
    choice,
    patch,
    clock,
    wound: woundStateFor(ctx.hp + (choice.heal ?? 0), ctx.maxHp, ctx.serious),
  };
}
