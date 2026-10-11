/**
 * Going shopping, as a piece of application state.
 *
 * The rules of the visit live in engine/vendors.ts and the writes live in
 * campaign/shopping.ts; this is only the part React needs — who you are seeing,
 * what happened when you asked for something, and whether the evening has been
 * charged for yet.
 *
 * The visit costs its time on the FIRST purchase rather than on opening the
 * drawer, so browsing is free and going somewhere is not. Looking through a
 * catalog is not an errand; coming home with something is.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  describeItemRecord,
  itemRecord,
  rangeTrial,
  skillLevelFor,
  getSkill,
  opposedPercent,
  HAGGLE_PITCH_MODIFIER,
  HAGGLE_READ,
  haggleRead,
  weaponProfile,
  type Hold,
  type RangeBand,
  type StatKey,
  hagglePercent,
  haggledPrice,
  FIXER_VENDOR,
  getVendor,
  shopsAt,
  type ItemKind,
  type Vendor,
} from "@/engine";
import {
  rollHaggle,
  recordHaggle,
  type HaggleOutcome,
  loadShopContext,
  purchase,
  callOffHold,
  placeHold,
  recordShopSeen,
  setShopInterests,
  wordAround,
  sell,
  sellOffers,
  shopShelf,
  reloadWeapon,
  reloadableWeapons,
  spendVisit,
  spareRounds,
  type StockedItem,
} from "@/features/campaign/shopping";
import { standingAt } from "@/features/campaign/favours";
import { actorFor } from "@/features/play/playModel";
import { liveRoleAbility, roleCheckModifiers } from "@/features/play/roleAbilityModel";
import { castMemberInRole } from "@/features/campaign/castSeeding";
import { findNpc, npcArtwork } from "@/features/cast/npcDirectory";
import { keeperImage } from "./shop/keeperArt";
import type { LifeBundle } from "./lifeOps";

export type ShopMessage = { tone: "bought" | "refused"; text: string };

/** Who is behind the counter, for the face on the Counter and the haggle scene. */
export type CounterKeeper = { name: string; who: string; image: string | null };

/** One argument over the price, settled: both rolls, so the scene can show them. */
export type HaggleSide = {
  total: number;
  /** Every die face: the d10, then its critical die when there was one. */
  rolls: number[];
  critical: "success" | "failure" | null;
  formula: string;
  modifiers: { label: string; value: number }[];
};

/** One argument over the price, settled: both rolls, so the scene can show them. */
export type HaggleScene = {
  vendorId: string;
  approachId: string;
  won: boolean;
  percent: number;
  tie: boolean;
  margin: number;
  yours: HaggleSide;
  theirs: HaggleSide;
};

/** What the character knows before pitching: the odds, and what they read in the keeper. */
export type HaggleSetup = {
  /** Their roll's base before the pitch, and the seller's. */
  base: number;
  against: number;
  /** What a pitch the keeper warms to adds, and one that puts them off costs. */
  pitch: number;
  /** The reading Skill, and what it told them: an approach id, or null. */
  readSkill: string;
  readLevel: number;
  warms: string | null;
  cools: string | null;
};

/**
 * `open` is whether the sheet is showing: a look at a shelf is written down
 * (for "new since your last visit") only when somebody is actually looking.
 */
export function useShop(
  bundle: LifeBundle | undefined,
  open = false,
  /** The seller to open on, when the story asked for one ("what have you got?"). */
  initialVendorId: string | null = null,
) {
  const queryClient = useQueryClient();
  const campaignId = bundle?.campaign.id;
  // The recent purchases and looks a shelf is read from, and who knows the character.
  const context = useQuery({
    queryKey: ["shop", campaignId],
    queryFn: () => loadShopContext(campaignId!),
    enabled: !!campaignId,
  });
  const [vendorId, setVendorId] = useState<string | null>(initialVendorId);
  const [message, setMessage] = useState<ShopMessage | null>(null);
  /** The last argument over the price, with both rolls, for the haggle scene. */
  const [lastHaggle, setLastHaggle] = useState<HaggleScene | null>(null);
  /** True once the player chose to call the fixer from somewhere that sells nothing. */
  const [fixerChosen, setFixerChosen] = useState(initialVendorId === FIXER_VENDOR.id);
  /** True once this visit has cost the character part of their evening. */
  const [visitCharged, setVisitCharged] = useState(false);
  /**
   * How the argument over the price went at this vendor, this visit.
   *
   * One per visit, which is the printed "only one Fixer deal per transaction"
   * and is also the only thing stopping a player rerolling until they win. A
   * lost argument stays lost until they go somewhere else or come back another
   * day, so asking is a real decision rather than a free button.
   */
  const [haggled, setHaggled] = useState<{
    vendorId: string;
    won: boolean;
    percent: number;
  } | null>(null);

  // Whoever sells where the character is standing, and the fixer, who is a call.
  // Anywhere that is not a shop that is the fixer alone: the rest is a trip away.
  const stood = bundle ? standingAt(bundle.campaign) : null;
  const vendors = useMemo(() => [...shopsAt(stood), FIXER_VENDOR], [stood]);
  const vendor: Vendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) ?? vendors[0]!,
    [vendors, vendorId],
  );
  const eurobucks = bundle?.vitals.eurobucks ?? 0;
  // The Fixer's Operator, which decides both what a won argument is worth and
  // what the shelf never has to be rolled for. Null for every other Role.
  const ability = bundle ? liveRoleAbility(bundle.character) : null;
  const isFixer = ability?.info.abilityId === "operator";
  const operatorRank = isFixer ? ability.rank : 0;
  /** The discount standing at this vendor right now, if the price was argued down. */
  const discount = haggled?.vendorId === vendor.id && haggled.won ? haggled.percent : 0;
  const day = bundle?.campaign.day ?? 1;
  const view = useMemo(() => {
    if (!bundle || !context.data) return null;
    const read = shopShelf({
      vendor,
      campaignId: bundle.campaign.id,
      day,
      eurobucks,
      context: { ...context.data, places: bundle.places },
      operatorRank,
    });
    // A won argument changes the price on everything the shelf shows.
    const priced = (items: StockedItem[]) =>
      items.map((item) => {
        const price = haggledPrice(item.price, item.key === "last_one" ? 0 : discount);
        return { ...item, price, affordable: price <= eurobucks };
      });
    return { ...read, shelf: priced(read.shelf), fresh: priced(read.fresh) };
  }, [bundle, context.data, vendor, day, eurobucks, operatorRank, discount]);

  // Write down that this shelf was looked at, once per seller per stock week.
  const marked = useRef(new Set<string>());
  useEffect(() => {
    if (!open || !bundle || !view?.firstLookThisWeek) return;
    const key = `${vendor.id}#${day}`;
    if (marked.current.has(key)) return;
    marked.current.add(key);
    void recordShopSeen({
      campaignId: bundle.campaign.id,
      vendor,
      day,
      places: bundle.places,
    })
      .then(() => queryClient.invalidateQueries({ queryKey: ["shop", bundle.campaign.id] }))
      // A look that failed to be written only costs the next visit its "new" strip.
      .catch(() => marked.current.delete(key));
  }, [open, bundle, view?.firstLookThisWeek, vendor, day, queryClient]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["life", bundle?.campaign.id] });
    void queryClient.invalidateQueries({ queryKey: ["play", bundle?.campaign.id] });
    void queryClient.invalidateQueries({ queryKey: ["shop", bundle?.campaign.id] });
  }, [queryClient, bundle?.campaign.id]);

  const buy = useMutation({
    mutationFn: async ({ item, quantity }: { item: StockedItem; quantity: number }) => {
      if (!bundle) throw new Error("Still loading.");
      const outcome = await purchase({
        campaignId: bundle.campaign.id,
        vendorId: vendor.id,
        kind: item.kind as ItemKind,
        itemId: item.itemId,
        quantity,
        isFixer,
        operatorRank,
        haggleWon: discount > 0,
      });
      // The evening goes whether you buy one box of rounds or six, so the time
      // is charged once — and only once something actually happened.
      if (outcome.ok && !visitCharged) {
        await spendVisit(bundle.campaign.id, vendor.id);
        setVisitCharged(true);
      }
      return outcome;
    },
    onSuccess: (outcome) => {
      setMessage(
        outcome.ok
          ? {
              tone: "bought",
              text:
                `${outcome.quantity > 1 ? `${outcome.quantity}× ` : ""}${outcome.name} — ` +
                `${outcome.spent}eb` +
                (outcome.saved > 0 ? `, ${outcome.saved}eb off` : "") +
                (outcome.stockKey === "reach" ? ", sourced on Reach" : "") +
                ".",
            }
          : { tone: "refused", text: outcome.reason },
      );
      invalidate();
    },
    onError: (error: Error) => setMessage({ tone: "refused", text: error.message }),
  });

  // A haggle is rolled on screen, die in hand, like every other check, and
  // written the moment it is rolled: the visit's one try is spent by rolling,
  // not by watching the second die land, so closing the scene cannot retry it.
  const recordArgument = useMutation({
    mutationFn: async (input: { outcome: HaggleOutcome; approachId: string }) => {
      if (!bundle) throw new Error("Still loading.");
      await recordHaggle({
        campaignId: bundle.campaign.id,
        vendorId: vendor.id,
        outcome: input.outcome,
        approachId: input.approachId,
      });
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => setMessage({ tone: "refused", text: error.message }),
  });

  const haggleActor = useCallback(() => {
    if (!bundle) throw new Error("Still loading.");
    return {
      actor: actorFor(bundle.character, { vitals: bundle.vitals, inventory: bundle.inventory }),
      // The Operator Rank rides on the roll itself, per the printed Haggle
      // formula. Taken from the same helper every other check uses, so the
      // shop and the job screen cannot disagree about what a Fixer adds.
      modifiers: roleCheckModifiers({
        campaign: bundle.campaign,
        character: bundle.character,
        skillId: "trading",
      }),
    };
  }, [bundle]);

  const rollTheHaggle = useCallback(
    (approachId: string): HaggleScene => {
      if (!bundle) throw new Error("Still loading.");
      if (haggled?.vendorId === vendor.id) throw new Error("You have already argued the price.");
      const { actor, modifiers } = haggleActor();
      const outcome = rollHaggle({
        vendorId: vendor.id,
        actor,
        actorName: bundle.character.character.name,
        isFixer,
        operatorRank,
        modifiers,
        approachId,
      });
      const side = (r: HaggleOutcome["result"]["actor"]): HaggleSide => ({
        total: r.total,
        rolls: r.rolls,
        critical: r.critical,
        formula: r.formula,
        modifiers: r.modifiers,
      });
      const scene: HaggleScene = {
        vendorId: vendor.id,
        approachId,
        won: outcome.won,
        percent: outcome.percent,
        tie: outcome.result.tie,
        margin: outcome.result.margin,
        yours: side(outcome.result.actor),
        theirs: side(outcome.result.opponent),
      };
      setHaggled({ vendorId: vendor.id, won: outcome.won, percent: outcome.percent });
      setLastHaggle(scene);
      setMessage(
        outcome.won
          ? { tone: "bought", text: `They come down ${outcome.percent}%. Prices below are theirs.` }
          : { tone: "refused", text: "They do not move. That was your one run at it tonight." },
      );
      recordArgument.mutate({ outcome, approachId });
      return scene;
    },
    [bundle, vendor.id, haggled, haggleActor, isFixer, operatorRank, recordArgument],
  );

  // Word of mouth: what sellers who know the character have set aside elsewhere.
  const word = useMemo(
    () =>
      bundle && context.data
        ? wordAround({
            campaignId: bundle.campaign.id,
            day,
            context: { ...context.data, places: bundle.places },
            except: vendor.id,
          })
        : [],
    [bundle, context.data, day, vendor.id],
  );

  /** Your odds with a gun on this shop's range, off the tables the fight rolls on. */
  const tryOnRange = useCallback(
    (itemId: string): RangeBand[] => {
      if (!bundle || !vendor.range) return [];
      try {
        const profile = weaponProfile(itemId);
        if (!profile.statKey || !profile.skillId) return [];
        const actor = actorFor(bundle.character, {
          vitals: bundle.vitals,
          inventory: bundle.inventory,
        });
        const stat = actor.stats[profile.statKey as StatKey] ?? 0;
        return rangeTrial(itemId, stat + skillLevelFor(actor, profile.skillId));
      } catch {
        return [];
      }
    },
    [bundle, vendor.range],
  );

  /** What a thing in the kit has been through, from the shop's slice of the ledger. */
  const recordOf = useCallback(
    (row: { id: string; item_id: string }, name: string): string | null =>
      context.data
        ? describeItemRecord(
            itemRecord(
              [...context.data.events, ...(context.data.history ?? [])],
              { itemId: row.item_id, rowId: row.id, name },
              (id) => {
                try {
                  return getVendor(id).label;
                } catch {
                  return id;
                }
              },
            ),
          )
        : null,
    [context.data],
  );

  const holdOne = useMutation({
    mutationFn: async (item: StockedItem) => {
      if (!bundle) throw new Error("Still loading.");
      return placeHold({
        campaignId: bundle.campaign.id,
        vendorId: vendor.id,
        kind: item.kind,
        itemId: item.itemId,
      });
    },
    onSuccess: (outcome) => {
      setMessage(
        outcome.ok
          ? {
              tone: "bought",
              text: `They will hold ${outcome.hold.name} until day ${outcome.hold.until}. ${outcome.hold.deposit}eb down.`,
            }
          : { tone: "refused", text: outcome.reason },
      );
      invalidate();
    },
    onError: (error: Error) => setMessage({ tone: "refused", text: error.message }),
  });

  const callOff = useMutation({
    mutationFn: async (hold: Hold) => {
      if (!bundle) throw new Error("Still loading.");
      await callOffHold(bundle.campaign.id, hold);
    },
    onSuccess: () => {
      setMessage({ tone: "refused", text: "Back on the shelf. They kept the deposit." });
      invalidate();
    },
  });

  const askAround = useMutation({
    mutationFn: async (needs: string[]) => {
      if (!bundle) throw new Error("Still loading.");
      return setShopInterests(bundle.campaign.id, needs);
    },
    onSuccess: () => invalidate(),
  });

  const sellOne = useMutation({
    mutationFn: async (inventoryId: string) => {
      if (!bundle) throw new Error("Still loading.");
      return sell({ campaignId: bundle.campaign.id, vendorId: vendor.id, inventoryId });
    },
    onSuccess: (outcome) => {
      setMessage(
        outcome.ok
          ? { tone: "bought", text: `Sold ${outcome.name} for ${outcome.paid}eb.` }
          : { tone: "refused", text: outcome.reason },
      );
      invalidate();
    },
    onError: (error: Error) => setMessage({ tone: "refused", text: error.message }),
  });

  const reload = useMutation({
    mutationFn: async (weaponRowId: string) => {
      if (!bundle) throw new Error("Still loading.");
      return reloadWeapon(bundle.campaign.id, weaponRowId);
    },
    onSuccess: (outcome) => {
      setMessage(
        outcome.ok
          ? { tone: "bought", text: outcome.summary }
          : { tone: "refused", text: outcome.reason },
      );
      invalidate();
    },
    onError: (error: Error) => setMessage({ tone: "refused", text: error.message }),
  });

  // Who is behind the counter. A seller at a place names its own keeper; the
  // fixer is the campaign's own fixer, with the face the cast already has.
  const keeper: CounterKeeper | null = useMemo(() => {
    if (vendor.keeper) {
      return { ...vendor.keeper, image: keeperImage(vendor.id) };
    }
    if (vendor.castRole === "fixer" && bundle) {
      const member = castMemberInRole(bundle.npcs, "fixer");
      if (!member) return null;
      const npc = findNpc(member.name);
      return {
        name: member.name,
        who: member.standing,
        image: npc ? npcArtwork(npc).src : null,
      };
    }
    return null;
  }, [vendor, bundle]);

  // What the character knows before pitching: their base and the seller's,
  // counted from the same actor and modifiers the roll uses, and what their
  // reading Skill tells them about this keeper.
  const haggleSetup: HaggleSetup | null = useMemo(() => {
    if (!bundle) return null;
    const { actor, modifiers } = haggleActor();
    const stat = actor.stats[getSkill("trading").stat as StatKey];
    if (typeof stat !== "number") return null;
    const readLevel = skillLevelFor(actor, HAGGLE_READ.skill);
    const read = haggleRead(vendor, readLevel);
    return {
      base: stat + skillLevelFor(actor, "trading") + modifiers.reduce((sum, m) => sum + m.value, 0),
      against: vendor.haggle.cool + vendor.haggle.trading,
      pitch: HAGGLE_PITCH_MODIFIER,
      readSkill: getSkill(HAGGLE_READ.skill).name,
      readLevel,
      ...read,
    };
  }, [bundle, vendor, haggleActor]);

  return {
    vendor,
    vendors,
    keeper,
    haggleSetup,
    haggleOdds: haggleSetup ? opposedPercent(haggleSetup.base, haggleSetup.against) : null,
    lastHaggle: lastHaggle?.vendorId === vendor.id ? lastHaggle : null,
    /** True when the character is standing somewhere that sells. */
    atShop: vendors.length > 1,
    /** True once the player chose to deal with the fixer from somewhere that sells nothing. */
    fixerChosen,
    chooseFixer: () => setFixerChosen(true),
    setVendor: (id: string) => {
      setVendorId(id);
      setMessage(null);
    },
    /** What a won argument would be worth here, for the button that offers it. */
    hagglePercent: hagglePercent({ isFixer, operatorRank }),
    /** True once the price has been argued at this vendor this visit, win or lose. */
    haggleSpent: haggled?.vendorId === vendor.id,
    haggleDiscount: discount,
    rollHaggle: rollTheHaggle,
    /** True when the shelf never has to be rolled for: the Fixer's own Reach. */
    operatorRank,
    /** Everything on offer, this week. Empty while the ledger is still loading. */
    shelf: view?.shelf ?? [],
    /** What is in that was not the last time the character looked. */
    fresh: view?.fresh ?? [],
    /** True when this seller keeps a back room the character is not yet let into. */
    backRoomClosed: view?.backRoomClosed ?? false,
    /** Days until the shelf turns over. */
    restockIn: view?.restockIn ?? null,
    loading: !view,
    eurobucks,
    message,
    clearMessage: () => setMessage(null),
    busy:
      buy.isPending ||
      reload.isPending ||
      recordArgument.isPending ||
      sellOne.isPending ||
      holdOne.isPending ||
      callOff.isPending ||
      askAround.isPending,
    /** The one thing held for the character anywhere, if any. */
    hold: view?.hold ?? null,
    /** True when this seller knows the character: they will hold things. */
    knowsYou: view?.knowsYou ?? false,
    /** What the character asked sellers who know them to keep an eye out for. */
    interests: view?.interests ?? [],
    setInterests: (needs: string[]) => askAround.mutate(needs),
    placeHold: (item: StockedItem) => holdOne.mutate(item),
    callOffHold: (hold: Hold) => callOff.mutate(hold),
    /** What sellers who know the character set aside elsewhere this week. */
    word,
    tryOnRange,
    recordOf,
    /** What in the kit this seller would buy, and for how much. */
    offers: bundle ? sellOffers(vendor, bundle.inventory) : [],
    sell: (inventoryId: string) => sellOne.mutate(inventoryId),
    buy: (item: StockedItem, quantity: number) => buy.mutate({ item, quantity }),
    reload: (weaponRowId: string) => reload.mutate(weaponRowId),
    reloadable: bundle ? reloadableWeapons(bundle.inventory) : [],
    spareRounds: bundle ? spareRounds(bundle.inventory) : 0,
    /** Reset when the drawer closes, so the next trip out costs its own time. */
    endVisit: () => {
      setFixerChosen(false);
      setVisitCharged(false);
      setHaggled(null);
      setMessage(null);
    },
  };
}

/** Everything the shop screen reads and does: what `useShop` hands it. */
export type ShopController = ReturnType<typeof useShop>;
