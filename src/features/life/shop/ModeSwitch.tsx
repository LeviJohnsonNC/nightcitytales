/**
 * Counter or scene: the one switch between buying and playing.
 *
 * Shown above the Counter and above the scene alike while the character is
 * standing somewhere that sells, so going back and forth is the same press in
 * both directions instead of a small "Talk to them" one way and a log link the
 * other. Presentation only.
 */
import { MessageSquare, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModeSwitch({
  mode,
  seller,
  onCounter,
  onScene,
}: {
  mode: "counter" | "scene";
  /** Who sells here, for the counter's half of the switch. */
  seller: string;
  onCounter: () => void;
  onScene: () => void;
}) {
  const item = (on: boolean) =>
    cn(
      "flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-sm transition-colors",
      on
        ? "bg-accent/15 text-foreground"
        : "text-text-muted hover:bg-accent/5 hover:text-foreground",
    );
  return (
    <div
      role="group"
      aria-label="Shop or scene"
      className="flex border border-hairline bg-surface/60 backdrop-blur"
    >
      <button
        type="button"
        aria-pressed={mode === "counter"}
        className={item(mode === "counter")}
        onClick={onCounter}
      >
        <ShoppingBag aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{seller}</span>
      </button>
      <button
        type="button"
        aria-pressed={mode === "scene"}
        className={cn(item(mode === "scene"), "border-l border-hairline")}
        onClick={onScene}
      >
        <MessageSquare aria-hidden className="size-4 shrink-0" />
        <span className="truncate">The scene</span>
      </button>
    </div>
  );
}
