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
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getVendor,
  hagglePercent,
  haggledPrice,
  VENDORS,
  type ItemKind,
  type Vendor,
} from "@/engine";
import {
  haggle,
  purchase,
  reloadWeapon,
  reloadableWeapons,
  spendVisit,
  spareRounds,
  stockedShelf,
  type StockedItem,
} from "@/features/campaign/shopping";
import { actorFor } from "@/features/play/playModel";
import { liveRoleAbility, roleCheckModifiers } from "@/features/play/roleAbilityModel";
import type { LifeBundle } from "./lifeOps";

export type ShopMessage = { tone: "bought" | "refused"; text: string };

export function useShop(bundle: LifeBundle | undefined) {
  const queryClient = useQueryClient();
  const [vendorId, setVendorId] = useState<string>(VENDORS[0]!.id);
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

  const vendor: Vendor = useMemo(() => getVendor(vendorId), [vendorId]);
  const eurobucks = bundle?.vitals.eurobucks ?? 0;
  // The Fixer's Operator, which decides both what a won argument is worth and
  // what the shelf never has to be rolled for. Null for every other Role.
  const ability = bundle ? liveRoleAbility(bundle.character) : null;
  const isFixer = ability?.info.abilityId === "operator";
  const operatorRank = isFixer ? ability.rank : 0;
  /** The discount standing at this vendor right now, if the price was argued down. */
  const discount = haggled?.vendorId === vendor.id && haggled.won ? haggled.percent : 0;
  const shelf = useMemo(
    () =>
      stockedShelf(vendor, eurobucks).map((item) => {
        const price = haggledPrice(item.price, discount);
        return { ...item, price, affordable: price <= eurobucks };
      }),
    [vendor, eurobucks, discount],
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["life", bundle?.campaign.id] });
    void queryClient.invalidateQueries({ queryKey: ["play", bundle?.campaign.id] });
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
    vendors: VENDORS,
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
    shelf,
    eurobucks,
    message,
    clearMessage: () => setMessage(null),
    busy: buy.isPending || reload.isPending || argue.isPending,
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
