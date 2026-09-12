/**
 * The map pin that lives in the play headers. Shows where you are and opens the
 * city map on tap.
 */
import { Suspense, lazy, useState } from "react";
import { MapPin } from "lucide-react";
import { describePosition, type PlaceSignal } from "@/engine";
import type { PlaceHere } from "./PlaceDossier";

/**
 * Loaded on first open. The modal carries the map warp fit and the dossier
 * corpus behind it, and this pin sits in the header of every play and Life
 * screen — so eagerly mounting it put both in the bundle for everyone who
 * never opened the map.
 *
 * The type import above is erased at build time and costs nothing.
 */
const MapModal = lazy(() => import("./MapModal").then((m) => ({ default: m.MapModal })));

export function MapButton({
  locationKey,
  knownPlaces,
  className,
  onTravel,
  travelBusy,
  signals,
  placeHere,
  open: openProp,
  onOpenChange,
}: {
  locationKey?: string | null | undefined;
  knownPlaces?: string[] | undefined;
  className?: string | undefined;
  onTravel?: ((districtKey: string) => void) | undefined;
  travelBusy?: boolean | undefined;
  signals?: PlaceSignal[] | undefined;
  placeHere?: ((key: string) => PlaceHere | undefined) | undefined;
  /**
   * The map is opened from this pin. A screen that needs to open it itself can
   * own that by passing these; without them the button keeps its own state.
   */
  open?: boolean | undefined;
  onOpenChange?: ((v: boolean) => void) | undefined;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  // Once opened it stays mounted, so closing keeps its animation. A screen that
  // drives `open` itself can open the map without this button being pressed.
  const [everOpened, setEverOpened] = useState(false);
  const mounted = everOpened || open;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEverOpened(true);
          setOpen(true);
        }}
        aria-label="Open the map of Night City"
        className={`flex min-h-11 items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-left transition-colors hover:border-accent hover:text-accent ${className ?? ""}`}
      >
        <MapPin className="h-4 w-4 shrink-0 text-accent" />
        <span className="max-w-[9rem] truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:max-w-[16rem]">
          {describePosition(locationKey)}
        </span>
      </button>
      {mounted ? (
        <Suspense fallback={null}>
          <MapModal
            open={open}
            onOpenChange={setOpen}
            locationKey={locationKey}
            knownPlaces={knownPlaces}
            onTravel={onTravel}
            travelBusy={travelBusy}
            signals={signals}
            placeHere={placeHere}
          />
        </Suspense>
      ) : null}
    </>
  );
}
