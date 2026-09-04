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
  LANDMARKS,
  MAP_IMAGE,
  describePosition,
  getDistrict,
  mapPointOf,
  resolvePosition,
  signalForDistrict,
  signalForPlace,
  travelMinutes,
  type District,
  type MapPoint,
  type PlaceSignal,
} from "@/engine";
import { PlaceDossier } from "./PlaceDossier";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/** How far a pointer must travel before the gesture stops being a tap. */
const PAN_THRESHOLD_PX = 4;

export function MapModal({
  open,
  onOpenChange,
  locationKey,
  knownPlaces = [],
  onTravel,
  travelBusy = false,
  signals = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locationKey?: string | null | undefined;
  knownPlaces?: string[] | undefined;
  /** When given, districts other than the current one offer a trip. */
  onTravel?: ((districtKey: string) => void) | undefined;
  travelBusy?: boolean | undefined;
  /**
   * What is worth knowing about somewhere, from the engine. Deliberately few:
   * the budget is three across the whole city (see engine/placeSignals.ts), so
   * most pins carry nothing and the map reads quiet.
   */
  signals?: PlaceSignal[] | undefined;
}) {
  const [zoom, setZoom] = useState(1.4);
  const [dossier, setDossier] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    /** True once the gesture has moved far enough to be a pan rather than a tap. */
    panning: boolean;
  } | null>(null);
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

  // Where the pin actually sits: the venue or the landmark's own point when the
  // atlas places it there, otherwise the district's.
  const youAreHere: MapPoint | null = useMemo(() => mapPointOf(locationKey) ?? null, [locationKey]);

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

  // Centre every time the map opens. The dialog animates in and the image
  // loads after mount, so a single frame is never enough: keep re-centring on
  // every resize and on a short schedule until the layout has stopped moving.
  useEffect(() => {
    if (!open || !youAreHere) return;
    const el = scroller.current;
    if (!el) return;
    const until = Date.now() + 900;
    const attempt = () => {
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth) scrollToPoint(youAreHere);
    };
    attempt();
    const observer = new ResizeObserver(attempt);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    const tick = window.setInterval(() => {
      attempt();
      if (Date.now() > until) window.clearInterval(tick);
    }, 80);
    return () => {
      observer.disconnect();
      window.clearInterval(tick);
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
    // Deliberately NOT capturing the pointer yet. Capturing on pointerdown
    // retargets the whole gesture to the scroller, so the pointerup never
    // reaches the pin underneath and the click that opens a district's dossier
    // is never dispatched — the map became unusable as anything but a picture.
    // Capture starts when a drag actually starts, below.
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      panning: false,
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = scroller.current;
    const start = drag.current;
    if (!el || !start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // A tap wanders a pixel or two, especially on a touchscreen. Below the
    // threshold this is still a tap and the pin keeps its click.
    if (!start.panning) {
      if (Math.abs(dx) < PAN_THRESHOLD_PX && Math.abs(dy) < PAN_THRESHOLD_PX) return;
      start.panning = true;
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = start.left - dx;
    el.scrollTop = start.top - dy;
  }
  function endDrag(e: React.PointerEvent) {
    const panning = drag.current?.panning ?? false;
    drag.current = null;
    if (panning) scroller.current?.releasePointerCapture(e.pointerId);
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
                aria-label="Centre on me"
                disabled={!youAreHere}
                onClick={centreOnMe}
              >
                <Crosshair className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Zoom out"
                onClick={() => changeZoom(-0.4)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Zoom in"
                onClick={() => changeZoom(0.4)}
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
                onLoad={centreOnMe}
                className="pointer-events-none absolute inset-0 h-full w-full object-fill"
              />

              {/* The city's named geography: the bridges, the bays, the canal.
                  Drawn small and quiet — they orient the player, they are not
                  the districts. */}
              {LANDMARKS.map((landmark) => (
                <span
                  key={landmark.key}
                  aria-hidden
                  title={landmark.name}
                  className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-foreground/50 bg-background/70"
                  style={{ left: `${landmark.map.x}%`, top: `${landmark.map.y}%` }}
                />
              ))}

              {DISTRICTS.map((district) => {
                const isHere = currentDistrict?.key === district.key;
                const isKnown = known.has(district.key);
                // At most one per district, and three in the whole city. The
                // engine has already applied that budget; this only draws it.
                const signal = signalForDistrict(signals, district.key);
                // Standing in a named venue puts the pin on the venue itself.
                const point = isHere && youAreHere ? youAreHere : district.map;
                return (
                  <button
                    key={district.key}
                    type="button"
                    onClick={() => setDossier(district.key)}
                    aria-label={
                      signal
                        ? `${district.name} district — ${signal.label}, at ${signal.placeName}`
                        : `${district.name} district`
                    }
                    data-here={isHere ? "true" : undefined}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
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
                      {signal ? (
                        <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap border border-ember/60 bg-background/95 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-foreground">
                          <span aria-hidden>{signal.icon}</span>
                          {signal.placeName}
                        </span>
                      ) : null}
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
          rightNow={(key) => signalForPlace(signals, key) ?? signalForDistrict(signals, key)}
          {...(onTravel
            ? {
                // The reader can follow a district into one of its locations,
                // so the button is built from what is on show, not from what
                // opened the dialog. Nowhere to travel to when it is where the
                // character already stands.
                action: (showing: string) =>
                  showing === currentDistrict?.key ? null : (
                    <Button
                      type="button"
                      className="w-full"
                      disabled={travelBusy}
                      onClick={() => {
                        onTravel(showing);
                        setDossier(null);
                        onOpenChange(false);
                      }}
                    >
                      {travelBusy
                        ? "On the move…"
                        : `Travel here · ${travelMinutes(locationKey, showing)} min`}
                    </Button>
                  ),
              }
            : {})}
        />
      ) : null}
    </>
  );
}
