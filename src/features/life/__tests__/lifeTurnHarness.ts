/**
 * An in-memory campaign for driving one Life turn through `liveTurn`.
 *
 * Not a test file: the shared store and the fake backend adapter the Life turn
 * tests mock `@/lib/backend` with. Every write the turn makes lands in `db`, and
 * every read comes back out of it, so a test asserts on what the campaign holds
 * afterwards rather than on which functions were called.
 *
 * Two fidelity rules the real adapter has and a lazy fake would not:
 * `saveCampaignNpc` REPLACES `data` (the row is updated with the patch, not
 * merged into), and `getCampaign` returns the live balance, which is what the
 * Downtime operations price bills against.
 */
import type {
  Campaign,
  CampaignClock,
  CampaignEvent,
  CampaignFaction,
  CampaignFlag,
  CampaignInventoryItem,
  CampaignNpc,
  CampaignPlace,
  CampaignSituation,
  CampaignVitals,
  FullCharacter,
  Json,
  SituationUpsert,
} from "@/lib/backend";
import type { LifeWireResponse } from "../lifeResponse";

export const CAMPAIGN_ID = "camp-1";

export type Db = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  inventory: CampaignInventoryItem[];
  npcs: CampaignNpc[];
  flags: CampaignFlag[];
  situations: CampaignSituation[];
  clocks: CampaignClock[];
  factions: CampaignFaction[];
  places: CampaignPlace[];
  events: CampaignEvent[];
  /** Model replies, consumed one per `lifeTurnFn` call. */
  replies: LifeWireResponse[];
  /** Every user prompt the model was shown. */
  prompts: string[];
  /** Every write to `campaign_npcs.data`, in order, as the patch was sent. */
  npcWrites: { npcKey: string; data: Json }[];
};

let seq = 0;
const at = () => new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString();

export function makeCharacter(): FullCharacter {
  const stats = {
    int: 6,
    ref: 7,
    dex: 6,
    tech: 5,
    cool: 6,
    will: 6,
    luck: 5,
    move: 6,
    body: 6,
    emp: 6,
  };
  return {
    character: {
      id: "char-1",
      name: "Vincent Kang",
      handle: "Vin",
      role: "solo",
      creation_method: "streetrat",
    },
    stats,
    skills: [
      { skill_id: "perception", level: 4, specialization: null },
      { skill_id: "persuasion", level: 3, specialization: null },
      { skill_id: "brawling", level: 4, specialization: null },
      { skill_id: "athletics", level: 3, specialization: null },
    ],
    roleAbility: { rank: 4, ability_id: "combat_awareness" },
    gear: [],
    cyberware: [],
    lifepath: { general: {} },
    finance: { home_district_key: null, home_place_key: null },
  } as unknown as FullCharacter;
}

export function freshDb(over: { location?: string; day?: number; eurobucks?: number } = {}): Db {
  seq = 0;
  const campaign = {
    id: CAMPAIGN_ID,
    user_id: "user-1",
    character_id: "char-1",
    name: "A life",
    phase: "life",
    status: "active",
    day: over.day ?? 3,
    minute: 18 * 60,
    location_key: over.location ?? "o3",
    known_places: [],
    role_state: {},
    current_mission_id: null,
    bills_paid_through_day: 0,
    housing_id: null,
    lifestyle_id: null,
    home_place_key: null,
    ip_awarded: null,
    created_at: at(),
    updated_at: at(),
  } as unknown as Campaign;
  const vitals = {
    campaign_id: CAMPAIGN_ID,
    eurobucks: over.eurobucks ?? 500,
    hp_current: 40,
    hp_max: 40,
    humanity_current: 60,
    humanity_max: 60,
    luck_current: 5,
    mortal_save_failures: 0,
    seriously_wounded_threshold: 20,
    wound_state: "unwounded",
    updated_at: at(),
  } as unknown as CampaignVitals;
  return {
    campaign,
    vitals,
    character: makeCharacter(),
    inventory: [],
    npcs: [],
    flags: [],
    situations: [],
    clocks: [],
    factions: [],
    places: [],
    events: [],
    replies: [],
    prompts: [],
    npcWrites: [],
  };
}

/** The fake adapter, bound to whatever `db()` returns at call time. */
export function fakeBackend(db: () => Db) {
  const clone = <T>(value: T): T => structuredClone(value);
  const event = (row: Record<string, unknown>): CampaignEvent => {
    seq += 1;
    const stored = {
      id: `ev-${seq}`,
      seq,
      beat_id: null,
      roll: null,
      created_at: at(),
      summary: null,
      data: {},
      ...row,
    } as unknown as CampaignEvent;
    db().events.push(stored);
    return stored;
  };
  const situationRow = (input: SituationUpsert): CampaignSituation => {
    const prior = db().situations.find((s) => s.situation_key === input.situationKey);
    const row = {
      id: prior?.id ?? `sit-${input.situationKey}`,
      campaign_id: CAMPAIGN_ID,
      created_at: prior?.created_at ?? at(),
      updated_at: at(),
      situation_key: input.situationKey,
      category: input.category,
      title: input.title,
      summary: input.summary ?? null,
      npc_key: input.npcKey ?? null,
      status: input.status ?? "live",
      severity: input.severity ?? 1,
      due_day: input.dueDay ?? null,
      last_shown_day: input.lastShownDay ?? null,
      data: input.data ?? prior?.data ?? {},
    } as unknown as CampaignSituation;
    if (prior) Object.assign(prior, row);
    else db().situations.push(row);
    return clone(row);
  };
  const findNpc = (key: string) => db().npcs.find((n) => (n.npc_id ?? n.name) === key) ?? null;

  return {
    // --- campaign ---------------------------------------------------------
    getCampaign: async () => ({
      campaign: clone(db().campaign),
      vitals: clone(db().vitals),
      inventory: clone(db().inventory),
      cyberware: [],
      npcs: clone(db().npcs),
      factions: clone(db().factions),
      flags: clone(db().flags),
      missions: [],
    }),
    getCharacter: async () => clone(db().character),
    updateCampaign: async (_id: string, patch: Partial<Campaign>) => {
      Object.assign(db().campaign, patch);
      return clone(db().campaign);
    },
    updateCampaignVitals: async (_id: string, patch: Partial<CampaignVitals>) => {
      Object.assign(db().vitals, patch);
      return clone(db().vitals);
    },
    setCampaignClock: async (_id: string, clock: { day: number; minute: number }) => {
      db().campaign.day = clock.day;
      db().campaign.minute = clock.minute;
      return clone(db().campaign);
    },
    setCampaignPhase: async (_id: string, phase: string) => {
      db().campaign.phase = phase;
      return clone(db().campaign);
    },
    setInventoryQuantity: async (id: string, quantity: number) => {
      const row = db().inventory.find((r) => r.id === id);
      if (row) row.quantity = quantity;
      return clone(row);
    },
    // --- flags ------------------------------------------------------------
    listCampaignFlags: async () => clone(db().flags),
    setCampaignFlag: async (_id: string, flag: string, value: Json = true as unknown as Json) => {
      const prior = db().flags.find((f) => f.flag === flag);
      if (prior) prior.value = value;
      else db().flags.push({ id: `flag-${flag}`, campaign_id: CAMPAIGN_ID, flag, value });
      return clone(db().flags.find((f) => f.flag === flag)!);
    },
    // --- people -----------------------------------------------------------
    listCampaignNpcs: async () => clone(db().npcs),
    findCampaignNpc: async (_id: string, key: string) => clone(findNpc(key)),
    saveCampaignNpc: async (_id: string, key: string, patch: { name?: string; data?: Json }) => {
      if (patch.data !== undefined) db().npcWrites.push({ npcKey: key, data: clone(patch.data) });
      const prior = findNpc(key);
      if (prior) {
        // An UPDATE with the patch: `data` is replaced whole, as Postgres does.
        Object.assign(prior, clone(patch));
        return clone(prior);
      }
      const row = {
        id: `npc-${key}`,
        campaign_id: CAMPAIGN_ID,
        npc_id: key,
        name: patch.name ?? key,
        data: patch.data ?? {},
        disposition: 0,
        status: "alive",
        location: null,
        notes: null,
        created_at: at(),
        updated_at: at(),
      } as unknown as CampaignNpc;
      db().npcs.push(row);
      return clone(row);
    },
    setNpcDisposition: async (rowId: string, disposition: number) => {
      const row = db().npcs.find((n) => n.id === rowId);
      if (row) row.disposition = disposition;
      return clone(row);
    },
    // --- ledger -----------------------------------------------------------
    appendCampaignEvent: async (row: Record<string, unknown>) => clone(event(row)),
    listCampaignEvents: async () => clone(db().events),
    lastCampaignEventOfType: async (_id: string, type: string) =>
      clone([...db().events].reverse().find((e) => e.type === type) ?? null),
    listCampaignEventsOfTypes: async (_id: string, types: readonly string[]) =>
      clone(db().events.filter((e) => types.includes(e.type))),
    listLatestCampaignEventsOfTypes: async (_id: string, types: readonly string[]) =>
      clone(db().events.filter((e) => types.includes(e.type))),
    listCampaignEventsAfter: async (_id: string, after: number | null) =>
      clone(db().events.filter((e) => after === null || e.seq > after)),
    // --- situations, clocks, factions ------------------------------------
    listSituations: async () => clone(db().situations),
    upsertSituation: async (_id: string, input: SituationUpsert) => situationRow(input),
    upsertSituations: async (_id: string, inputs: SituationUpsert[]) => inputs.map(situationRow),
    setSituationStatus: async (_id: string, key: string, status: string) => {
      const row = db().situations.find((s) => s.situation_key === key);
      if (row) row.status = status;
    },
    listClocks: async () => clone(db().clocks),
    upsertClock: async (
      _id: string,
      input: {
        clockKey: string;
        label: string;
        filled: number;
        segments: number;
        hidden?: boolean;
        data?: Json;
      },
    ) => {
      const prior = db().clocks.find((c) => c.clock_key === input.clockKey);
      const row = {
        id: prior?.id ?? `clock-${input.clockKey}`,
        campaign_id: CAMPAIGN_ID,
        clock_key: input.clockKey,
        label: input.label,
        filled: input.filled,
        segments: input.segments,
        hidden: input.hidden ?? false,
        data: input.data ?? prior?.data ?? {},
        created_at: prior?.created_at ?? at(),
        updated_at: at(),
      } as unknown as CampaignClock;
      if (prior) Object.assign(prior, row);
      else db().clocks.push(row);
      return clone(row);
    },
    listCampaignFactions: async () => clone(db().factions),
    upsertFactionStanding: async (
      _id: string,
      input: { factionId: string; name: string; standing: number; notes?: string | null },
    ) => {
      const prior = db().factions.find((f) => f.faction_id === input.factionId);
      const row = {
        id: prior?.id ?? `fac-${input.factionId}`,
        campaign_id: CAMPAIGN_ID,
        faction_id: input.factionId,
        name: input.name,
        standing: Math.round(input.standing),
        notes: input.notes ?? prior?.notes ?? null,
      } as unknown as CampaignFaction;
      if (prior) Object.assign(prior, row);
      else db().factions.push(row);
      return clone(row);
    },
    // --- places, truths, scenes ------------------------------------------
    listCampaignPlaces: async () => clone(db().places),
    upsertCampaignPlace: async (
      _id: string,
      input: {
        placeKey: string;
        dials: Record<string, number>;
        flags: string[];
        visits: number;
        firstVisitDay: number | null;
        lastVisitDay: number | null;
      },
    ) => {
      const prior = db().places.find((p) => p.place_key === input.placeKey);
      const row = {
        id: prior?.id ?? `place-${input.placeKey}`,
        campaign_id: CAMPAIGN_ID,
        place_key: input.placeKey,
        dials: input.dials as unknown as Json,
        flags: input.flags,
        visits: input.visits,
        first_visit_day: input.firstVisitDay,
        last_visit_day: input.lastVisitDay,
        created_at: prior?.created_at ?? at(),
        updated_at: at(),
      } as unknown as CampaignPlace;
      if (prior) Object.assign(prior, row);
      else db().places.push(row);
      return clone(row);
    },
    listCampaignTruths: async () => ({ available: false, rows: [] }),
    recordTruthDiscovery: async () => null,
    readCampaignScene: async () => null,
  };
}

/** A reply as the model sends it; `lifeTurnFn` normalizes it as the server does. */
export function reply(over: Partial<LifeWireResponse> = {}): LifeWireResponse {
  return {
    situation: { title: "The market at night", description: "Rain on the stall roofs." },
    timeSpent: 15,
    resolution: "They look around.",
    proposedActions: [],
    deltas: [],
    observations: [],
    ...over,
  };
}
