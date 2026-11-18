import {
  AMMUNITION,
  ARMOR,
  GEAR,
  WEAPONS,
  DEFAULT_START,
  effectiveSlot,
  resolveItemKind,
  slotFor,
} from "@/engine";
import type { CampaignEvent, CampaignInventoryItem, Json } from "@/lib/backend";
import { appendCampaignEvent, getCampaign } from "@/lib/backend";
import {
  commitChatInventory,
  listSceneItems,
  putSceneItems,
  type SceneItem,
} from "@/lib/backend/chatInventory";
import { kindOf, nameFor } from "@/features/play/carriedKit";
import type { ChatInventoryAction, SceneItemOffer } from "@/features/narration/chatInventory";

const catalog = [...GEAR, ...AMMUNITION, ...ARMOR, ...WEAPONS];

function words(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function mentions(text: string, phrase: string): boolean {
  const key = words(phrase);
  return !!key && ` ${words(text)} `.includes(` ${key} `);
}

function matching<T>(rows: readonly T[], item: string, names: (row: T) => string[]): T[] {
  const exact = rows.filter((row) => names(row).some((name) => words(name) === words(item)));
  return exact.length
    ? exact
    : rows.filter((row) => names(row).some((name) => mentions(name, item)));
}

export function inventoryPlayerInput(
  events: readonly CampaignEvent[],
  beforeId: string | undefined,
): CampaignEvent | undefined {
  const index = beforeId ? events.findIndex((event) => event.id === beforeId) : -1;
  if (index < 0) return undefined;
  return events
    .slice(0, index)
    .reverse()
    .find((event) => event.type === "player_input");
}

export function inventoryRequestOf(event: CampaignEvent | undefined): string | undefined {
  const data = event?.data as { requestId?: unknown } | null;
  return typeof data?.requestId === "string" ? data.requestId : event?.id;
}

export function sceneInventoryPrompt(rows: readonly SceneItem[]): string {
  const stock = rows.filter((row) => row.quantity > 0).slice(0, 10);
  if (!stock.length) return "";
  return (
    "\n\nITEMS HERE (already established)\n" +
    stock
      .map(
        (row) =>
          `- ${row.quantity} × ${nameFor(row.item_kind as ReturnType<typeof kindOf>, row.item_id)} · ${row.source}`,
      )
      .join("\n")
  );
}

export function sceneOfferRows(input: {
  campaignId: string;
  locationKey: string;
  offers: readonly SceneItemOffer[];
  narration: string;
  previousNarration: string;
  takes: readonly ChatInventoryAction[];
  checkSucceeded?: boolean;
}) {
  return input.offers.flatMap((offer) => {
    if (!mentions(input.narration, offer.item) || !mentions(input.narration, offer.source))
      return [];
    if (input.checkSucceeded === false) return [];
    const wantedHere = input.takes.some(
      (action) =>
        action.kind === "take_item" &&
        (mentions(offer.item, action.item) || mentions(action.item, offer.item)),
    );
    // An immediately requested item must already be in the fiction or earned
    // by the check that just settled. A player's description is never evidence.
    if (
      wantedHere &&
      !input.checkSucceeded &&
      (!mentions(input.previousNarration, offer.item) ||
        !mentions(input.previousNarration, offer.source))
    ) {
      return [];
    }
    const catalogItem = catalog.find(
      (item) => words(item.id) === words(offer.item) || words(item.name) === words(offer.item),
    );
    const itemId =
      catalogItem?.id ?? offer.item[0]!.toUpperCase() + offer.item.slice(1).toLowerCase();
    const itemKind = resolveItemKind(itemId) ?? "gear";
    return [
      {
        campaign_id: input.campaignId,
        location_key: input.locationKey,
        origin_key: `offer:${words(itemId)}:${words(offer.source)}`,
        source: offer.source,
        item_id: itemId,
        item_kind: itemKind,
        quantity: offer.quantity,
        slot: slotFor(itemKind, itemId),
        ...(itemKind === "weapon" ? { ammo_loaded: 0 } : {}),
      },
    ];
  });
}

export async function establishSceneItems(input: {
  campaignId: string;
  locationKey: string;
  offers: readonly SceneItemOffer[];
  narration: string;
  events: readonly CampaignEvent[];
  takes: readonly ChatInventoryAction[];
  checkSucceeded?: boolean;
}): Promise<void> {
  if (!input.offers.length) return;
  const previousNarration = input.events
    .filter(
      (event) =>
        (event.type === "life_narration" || event.type === "gm_narration") &&
        (event.data as { at?: unknown } | null)?.at === input.locationKey,
    )
    .slice(-6)
    .map((event) => event.summary ?? "")
    .join("\n");
  await putSceneItems(sceneOfferRows({ ...input, previousNarration }));
}

export async function applyChatInventory(input: {
  campaignId: string;
  locationKey: string;
  requestId: string;
  beatId?: string | null;
  action: ChatInventoryAction;
  events: readonly CampaignEvent[];
}): Promise<CampaignInventoryItem[] | null> {
  const { action, campaignId, locationKey, beatId } = input;
  const mode = action.kind === "take_item" ? "take" : action.mode;
  // A continuation sees the original command again, sometimes with a shorter
  // item name. It cannot withdraw the same prop at its new location.
  const alreadyDone = input.events.some((event) => {
    if (event.type !== "inventory_changed") return false;
    const data = event.data as {
      request_id?: string;
      mode?: string;
      intent_item?: string;
      selection?: string;
    } | null;
    if (data?.request_id !== input.requestId || data.mode !== mode) return false;
    const selection = action.kind === "take_item" ? action.source : action.destination;
    if (selection && data.selection && words(selection) !== words(data.selection)) return false;
    return (
      !!data.intent_item &&
      (mentions(data.intent_item, action.item) || mentions(action.item, data.intent_item))
    );
  });
  if (alreadyDone) return null;
  const refused = async (summary: string) => {
    await appendCampaignEvent({
      campaign_id: campaignId,
      ...(beatId ? { beat_id: beatId } : {}),
      type: "action_refused",
      summary,
      data: { code: "inventory_unavailable" },
    });
    return null;
  };
  const live = await getCampaign(campaignId);
  if (!live || (live.campaign.location_key ?? DEFAULT_START) !== locationKey) {
    return refused("You are somewhere else now.");
  }
  const scene = action.kind === "take_item" ? await listSceneItems(campaignId, locationKey) : [];
  const sources =
    action.kind === "take_item"
      ? matching(
          scene.filter(
            (row) =>
              !action.source ||
              mentions(row.source, action.source) ||
              mentions(action.source, row.source),
          ),
          action.item,
          (row) => [row.item_id, nameFor(row.item_kind as ReturnType<typeof kindOf>, row.item_id)],
        )
      : [];
  const held =
    action.kind === "remove_item"
      ? matching(
          live.inventory.filter((row) => row.kind !== "cyberware"),
          action.item,
          (row) => {
            const label = nameFor(kindOf(row), row.item_id);
            return [row.item_id, label, `${label} ${effectiveSlot(row) ?? ""}`];
          },
        )
      : [];

  if (action.kind === "remove_item" && action.mode === "give" && !action.destination) {
    return refused(`Who are you giving ${action.item} to?`);
  }
  const availableSources = sources.filter((row) => row.quantity > 0);
  const availableHeld = held.filter((row) => row.quantity > 0);
  if (availableSources.length > 1) {
    return refused(
      `Which ${action.item}? ${availableSources.map((row) => row.source).join(" or ")}.`,
    );
  }
  if (availableHeld.length > 1) {
    return refused(`Which ${action.item}? Specify the piece you want to remove.`);
  }
  const source = availableSources[0] ?? sources[0];
  const carry = availableHeld[0] ?? held[0];
  const itemId = source?.item_id ?? carry?.item_id ?? action.item;
  const kind = carry ? kindOf(carry) : source?.item_kind;
  const quantity =
    typeof action.quantity === "number"
      ? action.quantity
      : Math.max(1, source?.quantity ?? (action.quantity === "all" ? (carry?.quantity ?? 0) : 1));
  const name = kind ? nameFor(kind as ReturnType<typeof kindOf>, itemId) : action.item;
  const selection = action.kind === "take_item" ? action.source : action.destination;
  const qualifier = selection ?? (carry ? effectiveSlot(carry) : null) ?? "";
  const requestKey = `${input.requestId}:${mode}:${words(itemId)}:${words(qualifier)}`;
  const result = (await commitChatInventory({
    campaign_id: campaignId,
    location_key: locationKey,
    beat_id: beatId ?? null,
    request_key: requestKey,
    request_id: input.requestId,
    intent_item: action.item,
    selection: selection ?? null,
    mode,
    quantity,
    name,
    scene_item_id: source?.id ?? null,
    inventory_item_id: carry?.id ?? null,
    item_kind: kind ?? null,
    slot: carry ? effectiveSlot(carry) : null,
    destination: action.kind === "remove_item" ? (action.destination ?? null) : null,
  })) as { ok?: unknown; summary?: Json } | null;
  if (result?.ok !== true) {
    return refused(
      typeof result?.summary === "string"
        ? result.summary
        : "The inventory transfer could not be saved.",
    );
  }
  return (await getCampaign(campaignId))?.inventory ?? live.inventory;
}
