import { useEffect, useRef, useState } from "react";
import rolesData from "@/data/rules/roles.json";
import { uploadedAsset } from "./art";
import { fixerShortName } from "./interview";
import { sentenceFor } from "./lifepathNarrative";
import { readGeneralLifepath } from "./lifepathState";
import type { ChargenState } from "./store";
import { usePortraitUrl } from "./usePortraitUrl";
import { PortraitLightbox } from "./PortraitLightbox";
import { PHOTO_ANCHOR_Y, POLAROID_WINDOW, WINDOW_BLEED } from "./polaroidCrop";
import {
  fileProgress,
  firstPictureProgress,
  portraitClarity,
  type PortraitStage,
} from "./portraitStages";
import type { DevelopingPortrait, PortraitFrame } from "./useDevelopingPortrait";
import { cn } from "@/lib/utils";
import "./interview.css";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

/** The answers that say most about somebody at a glance, in the order a file would list them. */
const AT_A_GLANCE = ["personality", "value_most", "life_goals"] as const;

/**
 * A picture half-developed, as a CSS filter: blurred, dim, flat and brown when
 * it has just come out of the camera, and sharp and full-colour once the file
 * has everything. `clarity` runs 0 to 1.
 */
function developedLook(clarity: number): string {
  const c = Math.max(0, Math.min(1, clarity));
  const r = (n: number) => Math.round(n * 100) / 100;
  return [
    `blur(${r((1 - c) * 12)}px)`,
    `brightness(${r(0.5 + 0.5 * c)})`,
    `contrast(${r(0.75 + 0.25 * c)})`,
    `saturate(${r(0.15 + 0.85 * c)})`,
    `sepia(${r(0.45 * (1 - c))})`,
  ].join(" ");
}

/**
 * The file the fixer is keeping on you, filling in as you answer.
 *
 * A folder with an instant print clipped to it. The print starts black, the
 * way one does out of the camera; the first picture comes up as a smear of a
 * face, and it sharpens as the answers come in — steadily, one answered step
 * at a time, with a fresh picture at each of the three stages the budget pays
 * for (`portraitClarity`). It explains none of this. It is a photograph
 * developing, and a player can see that.
 *
 * Replaces the top of the step rail as the thing that tells a player how far
 * they have come: a face arriving, a handle being typed, a Role and a few
 * lines of who this person is is progress toward somebody you want to play.
 */
export function CharacterFile({
  state,
  developing,
}: {
  state: ChargenState;
  developing?: DevelopingPortrait;
}) {
  const stored = usePortraitUrl(state.portraitPath);
  const inFlight = developing?.developing ?? null;
  // What is on the print, in order of how fresh it is: the frame arriving, the
  // picture that just landed (until storage has its own address for it), then
  // the stored one. Each carries a key for WHICH picture it is.
  const landed =
    developing?.latest && developing.latest.path === state.portraitPath ? developing.latest : null;
  const portrait: PortraitFrame | null =
    (inFlight && developing?.preview) ||
    landed ||
    (stored && state.portraitPath ? { key: `path:${state.portraitPath}`, src: stored } : null);
  const stage = (portrait ? Math.min(3, Math.max(1, inFlight ?? state.portraitStage)) : 0) as
    0 | PortraitStage;
  const clarity = portraitClarity(
    stage,
    fileProgress(state),
    firstPictureProgress(state),
    developing?.stalled ?? false,
  );
  const fixer = state.castPlan?.picks.fixer ?? null;
  const role = state.roleId ? ROLE_NAMES[state.roleId]?.name : null;
  const handle = state.handle.trim();
  const name = state.name.trim();
  const entries = readGeneralLifepath(state.lifepath.general).entries;
  const glance = AT_A_GLANCE.map((id) => entries[id])
    .filter((entry) => entry !== undefined)
    .map((entry) => sentenceFor(entry));
  const folder = uploadedAsset("file-folder");
  const print = uploadedAsset("file-polaroid");

  return (
    <section
      aria-label="Your file"
      style={folder ? { backgroundImage: `url(${folder})` } : undefined}
      className={cn(
        "relative flex flex-col items-center bg-cover bg-top",
        // The folder art has a metal rim; everything sits inside it.
        folder
          ? "aspect-[2/3] px-[10%] pb-[10%] pt-[9%]"
          : "border border-hairline bg-surface px-5 pb-5 pt-6",
      )}
    >
      <Print
        frame={print}
        portrait={portrait}
        clarity={clarity}
        developing={inFlight !== null}
        alt={handle || name || "Your portrait"}
        subtitle={handle ? `"${handle}"` : undefined}
      />
      {developing?.failed && !inFlight && (
        <button
          type="button"
          onClick={developing.retry}
          className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim hover:text-text"
        >
          Retake
        </button>
      )}

      <div className="mt-5 w-full space-y-2 font-mono">
        {fixer && (
          <p className="text-[10px] uppercase tracking-[0.22em] text-text-dim">
            Kept by {fixerShortName(fixer)}
          </p>
        )}
        <div>
          <p
            key={handle}
            className="cg-glitch break-words font-display text-lg font-bold uppercase leading-tight tracking-[0.08em]"
          >
            {handle ? `"${handle}"` : "Unknown"}
          </p>
          <p className="break-words text-xs text-text-muted">
            {[name, role].filter(Boolean).join(" · ") || "No name on file"}
          </p>
        </div>
        {glance.length > 0 && (
          <ul className="space-y-1 border-t border-foreground/15 pt-2 text-[11px] leading-snug text-text-muted">
            {glance.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** How long a new picture takes to come up over the one it replaces. */
const FADE_MS = 1600;

/**
 * The picture on the print, one frame at a time.
 *
 * A new frame is decoded first and then faded in OVER the old one, which stays
 * underneath until it has gone. Showing it the moment it arrived dipped the file
 * to black at every stage and flashed the old picture back when a new one
 * finished. A frame with the same key as the one showing is the same picture
 * at a different address and is swapped without a fade.
 */
function useFrames(next: PortraitFrame | null): {
  top: PortraitFrame | null;
  under: PortraitFrame | null;
  /** How the top frame came in. Fixed for as long as it is showing, so it is not re-run. */
  entrance: "develop" | "dissolve";
} {
  const [top, setTop] = useState(next);
  const [under, setUnder] = useState<PortraitFrame | null>(null);
  const [entrance, setEntrance] = useState<"develop" | "dissolve">("develop");
  const topRef = useRef(top);
  topRef.current = top;

  useEffect(() => {
    if (!next) {
      setTop(null);
      setUnder(null);
      return;
    }
    const showing = topRef.current;
    if (showing && showing.key === next.key) {
      if (showing.src !== next.src) setTop(next);
      return;
    }
    let live = true;
    const commit = () => {
      if (!live) return;
      setUnder(topRef.current);
      setEntrance(topRef.current ? "dissolve" : "develop");
      setTop(next);
    };
    const image = new Image();
    image.src = next.src;
    if (typeof image.decode === "function") image.decode().then(commit, commit);
    else {
      image.onload = commit;
      image.onerror = commit;
    }
    return () => {
      live = false;
    };
    // A frame is the same picture while its key is; the source alone is not a reason to run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.key, next?.src]);

  useEffect(() => {
    if (!under) return;
    const timer = window.setTimeout(() => setUnder(null), FADE_MS + 200);
    return () => window.clearTimeout(timer);
  }, [under]);

  return { top, under, entrance };
}

/**
 * The instant print. Black until there is a picture; the first one comes up
 * out of the black over several seconds, like film developing; every later one
 * dissolves in over the last, and a change in clarity eases rather than jumps.
 * Once the picture is fully developed it opens full size.
 */
function Print({
  frame,
  portrait,
  clarity,
  developing,
  alt,
  subtitle,
}: {
  frame: string | null;
  portrait: PortraitFrame | null;
  clarity: number;
  developing: boolean;
  alt: string;
  subtitle?: string | undefined;
}) {
  const { top, under, entrance } = useFrames(portrait);
  const look = { filter: developedLook(clarity), objectPosition: `50% ${PHOTO_ANCHOR_Y}%` };
  const layer = "absolute inset-0 h-full w-full object-cover transition-[filter] duration-[3000ms]";
  const photo = (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {under && (
        <img key={under.key} src={under.src} alt="" aria-hidden style={look} className={layer} />
      )}
      {top && (
        <img
          key={top.key}
          src={top.src}
          alt={alt}
          data-clarity={Math.round(clarity * 100)}
          style={look}
          className={cn(layer, entrance === "dissolve" ? "cg-fade-in" : "cg-develop")}
        />
      )}
      {developing && <div aria-hidden className="cg-breathe cg-sheen absolute inset-0" />}
    </div>
  );

  const body = frame ? (
    <>
      <div
        className="absolute"
        style={{
          top: `${(POLAROID_WINDOW.top - WINDOW_BLEED).toFixed(2)}%`,
          left: `${(POLAROID_WINDOW.left - WINDOW_BLEED).toFixed(2)}%`,
          width: `${(POLAROID_WINDOW.width + 2 * WINDOW_BLEED).toFixed(2)}%`,
          height: `${(POLAROID_WINDOW.height + 2 * WINDOW_BLEED).toFixed(2)}%`,
        }}
      >
        {photo}
      </div>
      <img src={frame} alt="" aria-hidden className="relative block w-full" />
    </>
  ) : (
    <div className="relative aspect-square w-full">{photo}</div>
  );

  const shell = cn(
    "relative w-[72%] -rotate-2",
    frame
      ? "drop-shadow-[0_10px_14px_rgb(0_0_0/0.6)]"
      : "bg-[#e9e4d6] px-[5.7%] pb-[22%] pt-[5.7%] shadow-[0_10px_24px_rgb(0_0_0/0.55)]",
  );

  // Only a finished picture opens: the full-size view is sharp, and would give
  // away a picture that is still developing.
  const finished = portrait !== null && clarity >= 1 && !developing;
  return (
    <>
      {finished ? (
        <PortraitLightbox src={portrait.src} alt={alt} subtitle={subtitle} className={shell}>
          {body}
        </PortraitLightbox>
      ) : (
        <div className={shell}>{body}</div>
      )}
      {!portrait && <span className="sr-only">No photo on file</span>}
    </>
  );
}
