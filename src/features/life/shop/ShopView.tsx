/**
 * The shop, bound to the campaign: `useShop` for what is on the counter, the
 * place's own painting for the storefront, and the nearest sellers for when
 * the character is standing nowhere that sells. Shown inline in the Life
 * screen's main column in place of the scene (`LifeScreen`).
 */
import { useMemo } from "react";
import { DEFAULT_START, nearestShops, type TravelMode } from "@/engine";
import { uploadedAsset } from "@/features/chargen/art";
import { PLACE_DOSSIERS } from "@/features/atlas/placeDossiers";
import type { LifeBundle } from "../lifeOps";
import { useShop } from "../useShop";
import { CounterView } from "./CounterView";

/** A place's painting, the wide cut, or null when it has none. */
export function placeImage(placeKey: string): string | null {
  const slug = PLACE_DOSSIERS[placeKey]?.image;
  return slug ? `/images/places/${slug}.webp` : null;
}

/** The small cut, for thumbnails. */
export function placeThumb(placeKey: string): string | null {
  const slug = PLACE_DOSSIERS[placeKey]?.image;
  return slug ? `/images/places/${slug}-640.webp` : null;
}

export function ShopView({
  bundle,
  onClose,
  onTravel,
  travelBusy = false,
  travelMode,
  onTalk,
}: {
  bundle: LifeBundle;
  onClose: () => void;
  onTravel?: ((placeKey: string) => void) | undefined;
  travelBusy?: boolean;
  travelMode?: TravelMode | undefined;
  onTalk?: (() => void) | undefined;
}) {
  const shop = useShop(bundle, true);
  const from = bundle.campaign.location_key ?? DEFAULT_START;
  const near = useMemo(() => nearestShops(from, travelMode), [from, travelMode]);
  // A seller at a place shows that place; the fixer and an unpictured place
  // show the shop backdrop the character creator uses.
  const image =
    (shop.vendor.place ? placeImage(shop.vendor.place) : null) ?? uploadedAsset("scene-shop");
  const close = () => {
    shop.endVisit();
    onClose();
  };
  return (
    <CounterView
      shop={shop}
      image={image}
      near={near}
      imageOf={placeThumb}
      onClose={close}
      onTravel={onTravel}
      travelBusy={travelBusy}
      onTalk={
        onTalk
          ? () => {
              shop.endVisit();
              onTalk();
            }
          : undefined
      }
    />
  );
}
