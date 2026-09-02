/**
 * The dossier for a piece of Night City: what the atlas says about a district
 * or one of its named locations, and the long-form entry written for it.
 *
 * Presentation only. Every fact comes from the engine's geography module, which
 * reads the official atlas data; the prose and the pictures come from
 * placeDossiers.ts, which the engine never imports.
 *
 * A district entry lists its locations rather than describing them, and each one
 * opens in place, so the dialog reads like turning a page rather than a wall of
 * every venue at once.
 */
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  areaOf,
  districtOfPlace,
  getDistrict,
  isCombatZone,
  type District,
  type Place,
} from "@/engine";
import { placeDossier, placeImage } from "./placeDossiers";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm leading-relaxed">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}{" "}
      </span>
      <span className="text-foreground/90">{value}</span>
    </p>
  );
}

/** The picture for a place, when one has been made for it. */
function Portrait({
  dossierKey,
  alt,
  className,
}: {
  dossierKey: string;
  alt: string;
  className?: string;
}) {
  const entry = placeDossier(dossierKey);
  if (!entry) return null;
  return (
    <div className={cn("relative aspect-[4/3] w-full overflow-hidden bg-background", className)}>
      <img src={placeImage(entry)} alt={alt} className="h-full w-full object-cover object-center" />
      <div className="pointer-events-none absolute inset-0 border border-ember/40" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ember/60 to-transparent" />
    </div>
  );
}

/** The written entry for a place, falling back to the atlas's own one-liner. */
function Entry({ dossierKey, blurb }: { dossierKey: string; blurb: string }) {
  const entry = placeDossier(dossierKey);
  if (!entry) {
    return blurb ? <p className="text-sm leading-relaxed text-foreground/90">{blurb}</p> : null;
  }
  return (
    <div className="space-y-3">
      {entry.text.split("\n\n").map((para, i) => (
        <p key={i} className="text-sm leading-relaxed text-foreground/90">
          {para}
        </p>
      ))}
    </div>
  );
}

export function DistrictBody({
  district,
  onOpenPlace,
}: {
  district: District;
  /** Open one of this district's locations in place. */
  onOpenPlace?: (key: string) => void;
}) {
  const area = areaOf(district.key);
  return (
    <div className="space-y-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          District {district.code}
          {area ? ` · ${area.name}` : ""}
          {isCombatZone(district.key) ? " · Combat Zone" : ""}
        </p>
        <h2 className="text-lg font-bold leading-tight">{district.name}</h2>
      </div>
      <Entry dossierKey={district.key} blurb={district.blurb} />
      {district.cityManager ? <Field label="City Manager" value={district.cityManager} /> : null}
      {district.security ? <Field label="Security" value={district.security} /> : null}
      {district.gangs.length ? <Field label="Gangs" value={district.gangs.join(", ")} /> : null}
      {district.locations.length ? (
        <div className="space-y-1 border-t border-hairline pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Known locations
          </p>
          <ul>
            {district.locations.map((l) => (
              <li key={l.key}>
                {onOpenPlace ? (
                  <button
                    type="button"
                    onClick={() => onOpenPlace(l.key)}
                    className="w-full cursor-pointer py-1 text-left text-sm leading-relaxed transition-colors hover:text-ember"
                    aria-label={`Open the atlas entry for ${l.name}`}
                  >
                    <span className="font-mono text-[10px] text-accent">{l.code}</span>{" "}
                    <span className="font-semibold border-b border-dotted border-ember/60">
                      {l.name}
                    </span>
                  </button>
                ) : (
                  <span className="block py-1 text-sm leading-relaxed">
                    <span className="font-mono text-[10px] text-accent">{l.code}</span>{" "}
                    <span className="font-semibold">{l.name}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function PlaceBody({
  place,
  district,
  onOpenDistrict,
}: {
  place: Place;
  district: District;
  /** Go back up to the district this location sits in. */
  onOpenDistrict?: (key: string) => void;
}) {
  const area = areaOf(district.key);
  return (
    <div className="space-y-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          {place.code} ·{" "}
          {onOpenDistrict ? (
            <button
              type="button"
              onClick={() => onOpenDistrict(district.key)}
              className="cursor-pointer uppercase tracking-[0.24em] text-accent transition-colors hover:text-ember"
              aria-label={`Back to ${district.name}`}
            >
              {district.name}
            </button>
          ) : (
            district.name
          )}
          {area ? ` · ${area.name}` : ""}
        </p>
        <h2 className="text-lg font-bold leading-tight">{place.name}</h2>
      </div>
      <Entry dossierKey={place.key} blurb={place.blurb} />
    </div>
  );
}

/** Dossier dialog for either a district key or a location key. */
export function PlaceDossier({
  targetKey,
  open,
  onOpenChange,
  action,
}: {
  targetKey: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * Optional footer control, e.g. "Travel here". Given the key on show rather
   * than the key the dialog opened on, so it follows the reader in.
   */
  action?: (key: string) => React.ReactNode;
}) {
  // What is on show. Starts at whatever opened the dialog and moves as the
  // reader follows a district into one of its locations, or back out again.
  const [showing, setShowing] = useState(targetKey);
  useEffect(() => setShowing(targetKey), [targetKey]);

  // Turning to a new entry means starting at the top of it. Without this the
  // dialog keeps the scroll position it had, so following a location from the
  // bottom of a district's list drops the reader into the middle of the new
  // text with its picture and heading already scrolled past.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [showing]);

  const placeDistrict = districtOfPlace(showing);
  const district = placeDistrict ?? getDistrict(showing);
  if (!district) return null;
  const place = placeDistrict?.locations.find((l) => l.key === showing.toLowerCase());
  const title = place ? place.name : district.name;
  const footer = action?.(place ? place.key : district.key);
  const portraitKey = place ? place.key : district.key;
  const hasPortrait = !!placeDossier(portraitKey);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={scroller}
        className="max-h-[85vh] max-w-[96vw] overflow-y-auto border border-hairline bg-surface p-0 sm:max-w-4xl"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {/*
          One child, deliberately. DialogContent lays its children out in a
          grid, and a grid row sized automatically around a child whose height
          comes from an aspect-ratio collapses to nothing — which drops the
          picture on top of the text underneath it.
        */}
        <div className="flex flex-col">
          <Portrait dossierKey={portraitKey} alt={title} className="shrink-0" />
          <div className="space-y-3 p-5 pt-4">
            {place ? (
              <PlaceBody place={place} district={district} onOpenDistrict={setShowing} />
            ) : (
              <DistrictBody district={district} onOpenPlace={setShowing} />
            )}
            {footer ? <div className="border-t border-hairline pt-3">{footer}</div> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
