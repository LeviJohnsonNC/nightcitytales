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
  hagglePercent,
  haggledPrice,
  FIXER_VENDOR,
  shopsAt,
  type ItemKind,
  type Vendor,
} from "@/engine";
import {
  haggle,
  loadShopContext,
  purchase,
  recordShopSeen,
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
import type { LifeBundle } from "./lifeOps";

export type ShopMessage = { tone: "bought" | "refused"; text: string };

/**
 * `open` is whether the sheet is showing: a look at a shelf is written down
 * (for "new since your last visit") only when somebody is actually looking.
 */
export function useShop(bundle: LifeBundle | undefined, open = false) {
  const queryClient = useQueryClient();
  const campaignId = bundle?.campaign.id;
  // The recent purchases and looks a shelf is read from, and who knows the character.
  const context = useQuery({
    queryKey: ["shop", campaignId],
    queryFn: () => loadShopContext(campaignId!),
    enabled: !!campaignId,
  });
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [message, setMessage] = useState<ShopMessage | null>(null);
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

  const argue = useMutation({
    mutationFn: async () => {
      if (!bundle) throw new Error("Still loading.");
      return haggle({
        campaignId: bundle.campaign.id,
        vendorId: vendor.id,
        actor: actorFor(bundle.character, {
          vitals: bundle.vitals,
          inventory: bundle.inventory,
        }),
        actorName: bundle.character.character.name,
        isFixer,
        operatorRank,
        // The Operator Rank rides on the roll itself, per the printed Haggle
        // formula. Taken from the same helper every other check uses, so the
        // shop and the job screen cannot disagree about what a Fixer adds.
        modifiers: roleCheckModifiers({
          campaign: bundle.campaign,
          character: bundle.character,
          skillId: "trading",
        }),
      });
    },
    onSuccess: (outcome) => {
      setHaggled({ vendorId: vendor.id, won: outcome.won, percent: outcome.percent });
      setMessage(
        outcome.won
          ? { tone: "bought", text: `They come down ${outcome.percent}%. Prices below are theirs.` }
          : { tone: "refused", text: "They do not move. That was your one run at it tonight." },
      );
      invalidate();
    },
    onError: (error: Error) => setMessage({ tone: "refused", text: error.message }),
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

  return {
    vendor,
    vendors,
    /** True when the character is standing somewhere that sells. */
    atShop: vendors.length > 1,
    setVendor: (id: string) => {
      setVendorId(id);
      setMessage(null);
    },
    /** What a won argument would be worth here, for the button that offers it. */
    hagglePercent: hagglePercent({ isFixer, operatorRank }),
    /** True once the price has been argued at this vendor this visit, win or lose. */
    haggleSpent: haggled?.vendorId === vendor.id,
    haggleDiscount: discount,
    haggle: () => argue.mutate(),
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
    busy: buy.isPending || reload.isPending || argue.isPending || sellOne.isPending,
    /** What in the kit this seller would buy, and for how much. */
    offers: bundle ? sellOffers(vendor, bundle.inventory) : [],
    sell: (inventoryId: string) => sellOne.mutate(inventoryId),
    buy: (item: StockedItem, quantity: number) => buy.mutate({ item, quantity }),
    reload: (weaponRowId: string) => reload.mutate(weaponRowId),
    reloadable: bundle ? reloadableWeapons(bundle.inventory) : [],
    spareRounds: bundle ? spareRounds(bundle.inventory) : 0,
    /** Reset when the drawer closes, so the next trip out costs its own time. */
    endVisit: () => {
      setVisitCharged(false);
      setHaggled(null);
      setMessage(null);
    },
  };
}
