/**
 * `/shop-review`: the Counter from static fixtures, for looking at it.
 *
 * Renders the shipping `CounterView` with a controller built from the engine's
 * own shelf functions and sample state, so the layout can be checked and
 * screenshotted with no account, database or model call. It is not a second
 * shop: buying here changes nothing but a message. `?shop=d3|k3|t2`,
 * `&known=0` for a stranger, `&away=1` for somewhere that sells nothing.
 */
import { useMemo, useState } from "react";
import {
  FIXER_VENDOR,
  gadgetId,
  getVendor,
  holdDeposit,
  nearestShops,
  rangeTrial,
  readGadget,
  shopsAt,
  shopStock,
  type Hold,
} from "@/engine";
import type { StockedItem } from "@/features/campaign/shopping";
import { CounterView } from "@/features/life/shop/CounterView";
import { placeImage, placeThumb } from "@/features/life/shop/ShopView";
import type { ShopController, ShopMessage } from "@/features/life/useShop";
import type { CampaignInventoryItem } from "@/lib/backend";

const SEED = "shop-review";
const DAY = 9;

function query(): URLSearchParams {
  return new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
}

/** A find, as the shelf would carry it. */
function find(id: string, extra: Partial<StockedItem> = {}): StockedItem {
  const g = readGadget(id)!;
  return {
    kind: "gear",
    itemId: id,
    name: g.name,
    price: g.cost,
    tier: "unusual",
    layer: "find",
    key: "find",
    available: true,
    left: 1,
    roll: null,
    affordable: true,
    ...extra,
  };
}

const KIT: CampaignInventoryItem[] = [
  {
    id: "r1",
    item_id: "heavy_pistol",
    kind: "weapon",
    slot: "weapon",
    quantity: 1,
    equipped: true,
  },
  { id: "r2", item_id: "kevlar", kind: "armor", slot: "body", quantity: 1, equipped: true },
  {
    id: "r3",
    item_id: gadgetId("hush_wrap", "quiet", "none", 4),
    kind: "gear",
    slot: "gear",
    quantity: 1,
    equipped: false,
  },
  { id: "r4", item_id: "medscanner", kind: "gear", slot: "gear", quantity: 1, equipped: false },
] as unknown as CampaignInventoryItem[];

export function ShopReview() {
  const q = query();
  const placeKey = q.get("shop") ?? "d3";
  const known = q.get("known") !== "0";
  const away = q.get("away") === "1";
  const vendors = useMemo(
    () => (away ? [FIXER_VENDOR] : [...shopsAt(placeKey), FIXER_VENDOR]),
    [away, placeKey],
  );
  const [vendorId, setVendorId] = useState(vendors[0]!.id);
  const [message, setMessage] = useState<ShopMessage | null>(null);
  const [interests, setInterests] = useState<string[]>(known ? ["quiet"] : []);
  const [fixerChosen, setFixerChosen] = useState(false);
  const vendor = vendors.find((v) => v.id === vendorId) ?? vendors[0]!;
  const eurobucks = 1840;

  const shelf = useMemo<StockedItem[]>(() => {
    const stock = shopStock({ vendor, seed: SEED, day: DAY, regular: known, backRoomOpen: known });
    const priced = stock.map((i) => ({ ...i, affordable: i.price <= eurobucks }));
    if (!vendor.place) return priced;
    // A week worth looking at: one find set aside, one hot, one from a raid.
    return [
      find(gadgetId("sound_puck", "remote", "unreliable", 0), { forYou: false }),
      find(`${gadgetId("lock_gun", "quiet", "none", 7)}.h-${placeKey}-arasaka`),
      find(`${gadgetId("foam_cutters", "quiet", "none", 2)}.s-a2-raided`, { forYou: known }),
      ...priced,
    ];
  }, [vendor, known, placeKey]);

  const hold: Hold | null = known
    ? {
        vendorId: "gun_shop@l5",
        vendorLabel: "The Quartermaster",
        kind: "weapon",
        itemId: "assault_rifle",
        name: "Assault Rifle",
        price: 500,
        deposit: holdDeposit(500),
        day: DAY - 2,
        until: DAY + 5,
      }
    : null;

  const say = (text: string) =>
    setMessage({ tone: "bought", text: `${text} (review only: nothing was saved)` });

  const shop = {
    vendor,
    vendors,
    atShop: vendors.length > 1,
    fixerChosen,
    chooseFixer: () => setFixerChosen(true),
    setVendor: (id: string) => setVendorId(id),
    hagglePercent: 5,
    haggleSpent: false,
    haggleDiscount: 0,
    haggle: () => say("They come down 5%."),
    operatorRank: 0,
    shelf,
    fresh: [],
    backRoomClosed: !known && vendor.backRoom.length > 0,
    restockIn: 5,
    loading: false,
    eurobucks,
    message,
    clearMessage: () => setMessage(null),
    busy: false,
    hold,
    knowsYou: known,
    interests,
    setInterests,
    placeHold: (item: StockedItem) => say(`They will hold ${item.name}.`),
    callOffHold: () => say("Back on the shelf."),
    word: known
      ? [
          {
            vendor: getVendor("street@k3"),
            item: find(gadgetId("relay_clip", "remote", "none", 3)),
          },
        ]
      : [],
    tryOnRange: (itemId: string) => rangeTrial(itemId, 14),
    recordOf: (row: { id: string }) =>
      row.id === "r1"
        ? "Bought at Toggle's Temple, day 3 · 14 shots, 9 hit."
        : row.id === "r3"
          ? "used 2 times."
          : null,
    buy: (item: StockedItem) => say(`Bought ${item.name}.`),
    reload: () => say("Loaded."),
    reloadable: [],
    spareRounds: 0,
    offers: KIT.map((row) => ({
      row,
      name:
        row.item_id === "heavy_pistol"
          ? "Heavy Pistol"
          : row.item_id === "kevlar"
            ? "Kevlar"
            : row.item_id === "medscanner"
              ? "Medscanner"
              : (readGadget(row.item_id)?.name ?? row.item_id),
      price: 50,
    })),
    sell: () => say("Sold."),
    endVisit: () => setMessage(null),
  } as unknown as ShopController;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <CounterView
        shop={shop}
        image={vendor.place ? placeImage(vendor.place) : null}
        near={nearestShops(placeKey).slice(0, 4)}
        imageOf={placeThumb}
        onClose={() => say("Left.")}
        onTravel={(key) => say(`Travelled to ${key}.`)}
        onTalk={() => say("Back to the scene.")}
      />
    </main>
  );
}
