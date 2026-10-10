/**
 * A short list of places to travel to, each with the trip's price in minutes.
 *
 * Shared by the shop and the ripperdoc: both are somewhere you have to be, and
 * both send you the way the map would. Presentational only; the trip is
 * priced by the engine and made by the caller's `onTravel`.
 */
import { Button } from "@/components/ui/button";

export type GoPlace = {
  placeKey: string;
  name: string;
  /** The smaller line under the name: the district, what is sold. */
  detail?: string | undefined;
  minutes: number;
};

export function GoThere({
  places,
  busy,
  onTravel,
}: {
  places: GoPlace[];
  busy: boolean;
  onTravel: (placeKey: string) => void;
}) {
  return (
    <ul className="mt-2 divide-y divide-border/50">
      {places.map((place) => (
        <li key={place.placeKey} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm">{place.name}</span>
            {place.detail && (
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {place.detail}
              </span>
            )}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={busy}
            onClick={() => onTravel(place.placeKey)}
          >
            {busy ? "On the move…" : `Go · ${place.minutes} min`}
          </Button>
        </li>
      ))}
    </ul>
  );
}
