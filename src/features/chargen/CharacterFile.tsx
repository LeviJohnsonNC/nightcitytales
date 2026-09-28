import rolesData from "@/data/rules/roles.json";
import { uploadedAsset } from "./art";
import { fixerShortName } from "./interview";
import { sentenceFor } from "./lifepathNarrative";
import { readGeneralLifepath } from "./lifepathState";
import type { ChargenState } from "./store";
import { usePortraitUrl } from "./usePortraitUrl";
import { fileProgress, portraitClarity, type PortraitStage } from "./portraitStages";
import type { DevelopingPortrait } from "./useDevelopingPortrait";
import { cn } from "@/lib/utils";
import "./interview.css";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

/** The answers that say most about somebody at a glance, in the order a file would list them. */
const AT_A_GLANCE = ["personality", "value_most", "life_goals"] as const;

/**
 * Where the photo sits inside `file-polaroid`, as percentages of that image,
 * measured from the uploaded file with its window cut out. The photo goes
 * BEHIND the print and runs a little past the window on every side, so the
 * painted, ragged edge of the window frames it and the paperclip stays on top.
 * Until the art is uploaded the print is drawn in CSS with the same shape.
 */
const POLAROID_WINDOW = { top: 11.07, left: 6.79, width: 86.21, height: 69.2 };
const WINDOW_BLEED = 1.2;

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
  const portrait = (inFlight && developing?.preview) || stored;
  const stage = (portrait ? Math.min(3, Math.max(1, inFlight ?? state.portraitStage)) : 0) as
    0 | PortraitStage;
  const clarity = portraitClarity(stage, fileProgress(state));
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
          <p className="truncate text-[10px] uppercase tracking-[0.22em] text-text-dim">
            Kept by {fixerShortName(fixer)}
          </p>
        )}
        <div>
          <p
            key={handle}
            className="cg-glitch truncate font-display text-lg font-bold uppercase tracking-[0.08em]"
          >
            {handle ? `"${handle}"` : "Unknown"}
          </p>
          <p className="truncate text-xs text-text-muted">
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

/**
 * The instant print. Black until there is a picture; a new picture comes up
 * out of the black over a few seconds, like film developing, and a change in
 * clarity eases rather than jumps.
 */
function Print({
  frame,
  portrait,
  clarity,
  developing,
  alt,
}: {
  frame: string | null;
  portrait: string | null;
  clarity: number;
  developing: boolean;
  alt: string;
}) {
  const photo = (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {portrait && (
        <img
          key={portrait}
          src={portrait}
          alt={alt}
          data-clarity={Math.round(clarity * 100)}
          style={{ filter: developedLook(clarity) }}
          className="cg-develop h-full w-full scale-105 object-cover transition-[filter] duration-[3000ms]"
        />
      )}
      {developing && <div aria-hidden className="cg-breathe cg-sheen absolute inset-0" />}
    </div>
  );

  return (
    <div
      className={cn(
        "relative w-[72%] -rotate-2",
        frame
          ? "drop-shadow-[0_10px_14px_rgb(0_0_0/0.6)]"
          : "bg-[#e9e4d6] px-[5.7%] pb-[22%] pt-[5.7%] shadow-[0_10px_24px_rgb(0_0_0/0.55)]",
      )}
    >
      {frame ? (
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
      )}
      {!portrait && <span className="sr-only">No photo on file</span>}
    </div>
  );
}
