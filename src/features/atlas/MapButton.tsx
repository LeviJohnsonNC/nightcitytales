/**
 * The map pin that lives in the play headers. Shows where you are and opens the
 * city map on tap.
 */
import { useState } from "react";
import { MapPin } from "lucide-react";
import { describePosition } from "@/engine";
import { MapModal } from "./MapModal";

export function MapButton({
  locationKey,
  knownPlaces,
  className,
}: {
  locationKey?: string | null;
  knownPlaces?: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the map of Night City"
        className={`flex min-h-11 items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-left transition-colors hover:border-accent hover:text-accent ${className ?? ""}`}
      >
        <MapPin className="h-4 w-4 shrink-0 text-accent" />
        <span className="max-w-[9rem] truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:max-w-[16rem]">
          {describePosition(locationKey)}
        </span>
      </button>
      <MapModal
        open={open}
        onOpenChange={setOpen}
        locationKey={locationKey}
        knownPlaces={knownPlaces}
      />
    </>
  );
}
