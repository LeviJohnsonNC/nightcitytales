/**
 * The Night City map. A pan/zoom view of the stitched atlas map with a pulsing
 * marker for where the character is standing and dimmer markers for districts
 * they have been to. Tapping a marker opens that district's dossier.
 *
 * Presentation only: every coordinate, name and fact comes from the engine's
 * geography module.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DISTRICTS,
  MAP_IMAGE,
  describePosition,
  getDistrict,
  getPlace,
  resolvePosition,
  travelMinutes,
  type District,
  type MapPoint,
} from "@/engine";
import { PlaceDossier } from "./PlaceDossier";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function MapModal({
  open,
  onOpenChange,
  locationKey,
  knownPlaces = [],
  onTravel,
  travelBusy = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locationKey?: string | null | undefined;
  knownPlaces?: string[] | undefined;
  /** When given, districts other than the current one offer a trip. */
  onTravel?: ((districtKey: string) => void) | undefined;
  travelBusy?: boolean | undefined;
}) {
  const [zoom, setZoom] = useState(1.4);
  const [dossier, setDossier] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  /** Fraction of the map to hold in the middle of the viewport across a zoom. */
  const pendingCenter = useRef<MapPoint | null>(null);

  const here = resolvePosition(locationKey);
  const known = useMemo(() => {
    const set = new Set<string>();
    for (const raw of knownPlaces) {
      const pos = resolvePosition(raw);
      if (pos) set.add(pos.districtKey);
    }
    return set;
  }, [knownPlaces]);

  const currentDistrict: District | undefined = here ? getDistrict(here.districtKey) : undefined;

  // Where the pin actually sits: the venue's own point when the atlas places
  // it, otherwise the district centroid.
  const youAreHere: MapPoint | null = useMemo(() => {
    const venue = here?.placeKey ? getPlace(here.placeKey) : undefined;
    if (venue?.map) return venue.map;
    return currentDistrict ? currentDistrict.map : null;
  }, [here?.placeKey, currentDistrict]);

  /** Scroll so a percentage point on the map lands in the middle of the view. */
  const scrollToPoint = useCallback((point: MapPoint) => {
    const el = scroller.current;
    if (!el) return false;
    const contentWidth = el.scrollWidth;
    const contentHeight = el.scrollHeight;
    if (contentWidth <= 0 || contentHeight <= 0) return false;
    el.scrollLeft = Math.max(0, (point.x / 100) * contentWidth - el.clientWidth / 2);
    el.scrollTop = Math.max(0, (point.y / 100) * contentHeight - el.clientHeight / 2);
    return true;
  }, []);

  const centreOnMe = useCallback(() => {
    if (youAreHere) scrollToPoint(youAreHere);
  }, [youAreHere, scrollToPoint]);

  // Centre when the map opens. The scroll area is only measurable once the
  // dialog has laid out and the image has a box, so we keep trying on every
  // resize of the content until the numbers are real, rather than betting on a
  // single animation frame.
  useEffect(() => {
    if (!open || !youAreHere) return;
    const el = scroller.current;
    if (!el) return;
    let settled = false;
    const attempt = () => {
      if (settled) return;
      if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
        if (scrollToPoint(youAreHere)) settled = true;
      }
    };
    attempt();
    const observer = new ResizeObserver(attempt);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    const timer = window.setTimeout(attempt, 250);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [open, youAreHere, scrollToPoint]);

  /** Zooming holds whatever was in the middle of the screen. */
  function changeZoom(delta: number) {
    const el = scroller.current;
    if (el && el.scrollWidth > 0 && el.scrollHeight > 0) {
      pendingCenter.current = {
        x: ((el.scrollLeft + el.clientWidth / 2) / el.scrollWidth) * 100,
        y: ((el.scrollTop + el.clientHeight / 2) / el.scrollHeight) * 100,
      };
    }
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))));
  }

  useLayoutEffect(() => {
    const point = pendingCenter.current;
    if (!point) return;
    pendingCenter.current = null;
    scrollToPoint(point);
  }, [zoom, scrollToPoint]);

  function onPointerDown(e: React.PointerEvent) {
    const el = scroller.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = scroller.current;
    const start = drag.current;
    if (!el || !start) return;
    el.scrollLeft = start.left - (e.clientX - start.x);
    el.scrollTop = start.top - (e.clientY - start.y);
  }
  function endDrag(e: React.PointerEvent) {
    drag.current = null;
    scroller.current?.releasePointerCapture(e.pointerId);
  }


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-5xl flex-col gap-0 border border-hairline bg-surface p-0">
          <DialogTitle className="sr-only">Map of Night City</DialogTitle>
          <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Night City
              </p>
              <p className="truncate text-sm font-semibold text-accent">
                {describePosition(locationKey)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 pr-8">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.4).toFixed(2)))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.4).toFixed(2)))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            ref={scroller}
            className="flex-1 touch-pan-x touch-pan-y overflow-auto bg-black"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div
              className="relative select-none"
              style={{
                width: `${zoom * 100}%`,
                aspectRatio: `${MAP_IMAGE.width} / ${MAP_IMAGE.height}`,
              }}
            >
              <img
                src={MAP_IMAGE.image}
                alt="Map of Night City from the Night City Atlas"
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-fill"
              />
              {DISTRICTS.map((district) => {
                const isHere = currentDistrict?.key === district.key;
                const isKnown = known.has(district.key);
                return (
                  <button
                    key={district.key}
                    type="button"
                    onClick={() => setDossier(district.key)}
                    aria-label={`${district.name} district`}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${district.map.x}%`, top: `${district.map.y}%` }}
                  >
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      {isHere ? (
                        <span className="absolute h-6 w-6 animate-ping rounded-full bg-accent/60" />
                      ) : null}
                      <span
                        className={
                          isHere
                            ? "h-3.5 w-3.5 rounded-full border-2 border-background bg-accent shadow-[0_0_12px_hsl(var(--accent))]"
                            : isKnown
                              ? "h-2.5 w-2.5 rounded-full border border-background bg-ember"
                              : "h-2 w-2 rounded-full border border-background/70 bg-foreground/40"
                        }
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>Drag to pan · tap a district</span>
            <span>Night City Atlas</span>
          </div>
        </DialogContent>
      </Dialog>
      {dossier ? (
        <PlaceDossier
          targetKey={dossier}
          open={dossier !== null}
          onOpenChange={(v) => !v && setDossier(null)}
          {...(onTravel && dossier !== currentDistrict?.key
            ? {
                action: (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={travelBusy}
                    onClick={() => {
                      onTravel(dossier);
                      setDossier(null);
                      onOpenChange(false);
                    }}
                  >
                    {travelBusy
                      ? "On the move…"
                      : `Travel here · ${travelMinutes(locationKey, dossier)} min`}
                  </Button>
                ),
              }
            : {})}
        />
      ) : null}
    </>
  );
}
