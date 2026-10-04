/**
 * Favours: what the people here will do for you, now that they are glad to see
 * you.
 *
 * Renders nothing unless the place the character is standing in has taken to
 * them (`welcome`) and has something its ground can offer, so the tile is a
 * thing that turns up the way a regular's welcome does rather than a button that
 * is always there. The goodwill behind it is never shown as a number: the sheet
 * says what each person would do, what it would take out of the day, and — when
 * they cannot, today — why not, in the voice of the place.
 */
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatDuration, type FavourOffer } from "@/engine";
import { DockTile } from "./hud/DockTile";
import { useFavours } from "./useFavours";
import type { LifeBundle } from "./lifeOps";

/** What it would do, in the one line a player decides on. */
function worth(offer: FavourOffer): string {
  const time = formatDuration(offer.minutes);
  if (offer.effect === "patch") {
    return offer.hpHealed > 0
      ? `Heals ${offer.hpHealed} HP · ${time}`
      : `A day's rest, in a fraction of the time · ${time}`;
  }
  return offer.heatEased > 0
    ? `Takes ${offer.heatEased} off NCPD heat · ${time}`
    : `Takes the heat off · ${time}`;
}

export function FavoursSheet({ bundle }: { bundle: LifeBundle }) {
  const favours = useFavours(bundle);
  if (bundle.phase !== "life" || favours.offers.length === 0) return null;
  const place = favours.offers[0]!.placeName;

  return (
    <Sheet onOpenChange={(open) => !open && favours.clearMessage()}>
      <SheetTrigger asChild>
        <DockTile icon={<Handshake className="size-6" />} label="Favours" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>{place}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            They are glad to see you here. If you needed something, they would go out on a limb. It
            is a kindness and not an account: one a day, and it does not come back by itself.
          </p>

          <ul>
            {favours.offers.map((offer) => (
              <li
                key={offer.key}
                className="flex items-start gap-3 border-b border-border/50 py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{offer.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {offer.description}
                  </span>
                  <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                    {offer.ready ? worth(offer) : offer.reason}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!offer.ready || favours.busy}
                  onClick={() => favours.callIn(offer.key)}
                >
                  Ask
                </Button>
              </li>
            ))}
          </ul>

          {favours.message && (
            <p
              role="status"
              className={
                favours.message.tone === "done"
                  ? "border-l-2 border-accent bg-accent/10 px-3 py-2 text-sm text-accent"
                  : "border-l-2 border-ember bg-ember/10 px-3 py-2 text-sm text-ember"
              }
            >
              {favours.message.text}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
