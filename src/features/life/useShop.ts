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
import { getVendor, VENDORS, type ItemKind, type Vendor } from "@/engine";
import {
  purchase,
  reloadWeapon,
  reloadableWeapons,
  spendVisit,
  spareRounds,
  stockedShelf,
  type StockedItem,
} from "@/features/campaign/shopping";
import type { LifeBundle } from "./useLife";

export type ShopMessage = { tone: "bought" | "refused"; text: string };

export function useShop(bundle: LifeBundle | undefined) {
  const queryClient = useQueryClient();
  const [vendorId, setVendorId] = useState<string>(VENDORS[0]!.id);
  const [message, setMessage] = useState<ShopMessage | null>(null);
  /** True once this visit has cost the character part of their evening. */
  const [visitCharged, setVisitCharged] = useState(false);

  const vendor: Vendor = useMemo(() => getVendor(vendorId), [vendorId]);
  const eurobucks = bundle?.vitals.eurobucks ?? 0;
  const shelf = useMemo(() => stockedShelf(vendor, eurobucks), [vendor, eurobucks]);

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
              text: `${outcome.quantity > 1 ? `${outcome.quantity}× ` : ""}${outcome.name} — ${outcome.spent}eb.`,
            }
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
    vendors: VENDORS,
    setVendor: (id: string) => {
      setVendorId(id);
      setMessage(null);
    },
    shelf,
    eurobucks,
    message,
    clearMessage: () => setMessage(null),
    busy: buy.isPending || reload.isPending,
    buy: (item: StockedItem, quantity: number) => buy.mutate({ item, quantity }),
    reload: (weaponRowId: string) => reload.mutate(weaponRowId),
    reloadable: bundle ? reloadableWeapons(bundle.inventory) : [],
    spareRounds: bundle ? spareRounds(bundle.inventory) : 0,
    /** Reset when the drawer closes, so the next trip out costs its own time. */
    endVisit: () => {
      setVisitCharged(false);
      setMessage(null);
    },
  };
}
