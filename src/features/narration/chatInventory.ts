import { z } from "zod";
import { wireObject } from "./narratorRules";

const MAX_TRANSFER_QUANTITY = 10_000;

const removalModes = ["drop", "stash", "give", "discard"] as const;
const name = z.string().trim().min(1).max(80);
const amount = z.number().int().min(1).max(MAX_TRANSFER_QUANTITY);
const requestedAmount = amount.or(z.literal("all")).optional();

export const TakeItemSchema = z.object({
  kind: z.literal("take_item"),
  item: name,
  quantity: requestedAmount,
  source: name.optional(),
});

export const RemoveItemSchema = z.object({
  kind: z.literal("remove_item"),
  item: name,
  quantity: requestedAmount,
  mode: z.enum(removalModes),
  destination: name.optional(),
});

export const SceneItemSchema = z.object({ item: name, quantity: amount.max(99), source: name });
export type SceneItemOffer = z.infer<typeof SceneItemSchema>;
export type ChatInventoryAction = z.infer<typeof TakeItemSchema> | z.infer<typeof RemoveItemSchema>;

const actionAliases: Record<string, "take_item" | "remove_item"> = {
  take_item: "take_item",
  pickup_item: "take_item",
  pick_up_item: "take_item",
  acquire_item: "take_item",
  remove_item: "remove_item",
  drop_item: "remove_item",
  stash_item: "remove_item",
  give_item: "remove_item",
  discard_item: "remove_item",
};

export function isInventoryAction(action: { kind: string }): action is ChatInventoryAction {
  return action.kind === "take_item" || action.kind === "remove_item";
}

function quantity(value: unknown): unknown {
  return typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
}

export function readChatInventoryAction(raw: unknown): ChatInventoryAction | null {
  const wire = wireObject(raw);
  const rawKind = wire?.["kind"] ?? wire?.["type"] ?? wire?.["action"];
  if (!wire || typeof rawKind !== "string") return null;
  const kind = rawKind
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const alias = Object.hasOwn(actionAliases, kind) ? actionAliases[kind] : undefined;
  if (!alias) return null;
  const rawQuantity = wire["quantity"] ?? wire["count"];
  const result = (alias === "take_item" ? TakeItemSchema : RemoveItemSchema).safeParse({
    kind: alias,
    item: wire["item"] ?? wire["itemId"] ?? wire["item_id"] ?? wire["name"],
    quantity: quantity(rawQuantity),
    source: wire["source"],
    mode: wire["mode"] ?? (kind === "remove_item" ? "drop" : kind.slice(0, -5)),
    destination: wire["destination"] ?? wire["recipient"],
  });
  return result.success ? result.data : null;
}

export function readSceneItemOffers(raw: unknown): SceneItemOffer[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).flatMap((value) => {
    const wire = wireObject(value);
    if (!wire) return [];
    const result = SceneItemSchema.safeParse({ ...wire, quantity: quantity(wire["quantity"]) });
    return result.success ? [result.data] : [];
  });
}

export const INVENTORY_ACTION_GUIDANCE = `
# ITEM TRANSFERS
- Recognize real player intent in ordinary language. Pocket, pick up, take, collect and accept an item that is here mean {"kind":"take_item","item":"<item name as shown>","quantity":<integer>,"source":"<source if needed>"}. Give away, discard, drop, leave behind and stash something carried mean {"kind":"remove_item","item":"<kit name>","quantity":<integer>,"mode":"give|discard|drop|stash","destination":"<recipient or local stash if named>"}. Use "all" when they explicitly say all. Omit quantity when unspecified, source when unambiguous, destination when none was named. Use exact names from the packet. Combine identical requests and keep actions in the order the player intended.
- Only give an item to someone present and willing to take it. Stash items where the character stands. Use the existing use_item action for consuming or using an item, and the Counter for trading. No inventory action for asking about an item, inspecting it, brandishing it, or moving it between pockets. No successful transfer in the prose. Describe the attempt and what the character sees. The game will show what actually went into or came out of their kit.
- Use "sceneItems": [{"item":"<physical item name also in your prose>","quantity":<integer>,"source":"<concrete place or willing giver also in your prose>"}] when the fiction establishes a loose portable object or a reward that can actually be taken at the current location. Register it on the turn it first appears, even if nobody picks it up. A successful salvage check can establish a new object. A gift must really be offered. Do not create items merely because the player claims they exist, list store stock as free, or mark background fixtures, possessions still held by others, or unseen items as available. If recent scene prose already established an item missing from ITEMS HERE, you may record it using that same source. Never restock a taken item. Use [] without new objects.
- Before a risky acquisition, propose the check and stop. After a successful result, finish the transfer only if the player intended to take the item. A failed check cannot create its reward. Resolve actions that follow a trip in the arrival turn and do not repeat actions already settled.
`;

export const SCENE_ITEMS_DESCRIPTION =
  "New portable objects actually available here. Each entry has item, quantity and a concrete source. " +
  "The item name and source must appear in narration. Empty when no new object is established.";
