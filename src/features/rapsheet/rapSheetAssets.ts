/**
 * Getting a Rap Sheet's pictures onto a canvas, and a PNG back off it.
 *
 * The one rule that matters here is that the canvas must never be TAINTED: a
 * canvas that has drawn a cross-origin image without permission refuses to
 * become a file. The cast's faces are same-origin, so a plain image does. The
 * character's portrait lives in private storage, so it arrives as BYTES (the
 * caller fetches them through the backend adapter) and is decoded from those —
 * which either works, or fails cleanly into a card with no picture, and never
 * into a card that cannot be saved.
 *
 * Browser-only, and every call degrades: a face that will not load is a
 * placeholder, a font that will not load is a fallback, and neither stops the
 * card being made.
 */
import { drawRapSheet, type RapAssets } from "./rapSheetCanvas";
import { RAP_FORMATS, type RapFormat, type RapSheet } from "./rapSheetModel";

/** Long enough for a slow connection, short enough that nobody stares at a spinner. */
const FONT_WAIT_MS = 2500;
const IMAGE_WAIT_MS = 6000;

const FONT_FACES = [
  '800 64px "Archivo"',
  '600 24px "IBM Plex Mono"',
  '500 24px "IBM Plex Mono"',
  '32px "Silkscreen"',
];

function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * The card's fonts, loaded before it is drawn. A canvas draws in whatever is
 * ready at that instant and does not redraw when a font arrives, so the first
 * card of a visit would otherwise come out in a fallback face.
 */
export async function ensureFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  await within(
    Promise.all(FONT_FACES.map((face) => document.fonts.load(face, "RAP SHEET 0123456789"))),
    FONT_WAIT_MS,
    [],
  );
}

/** A same-origin image, decoded; or null. */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/** A portrait's bytes, decoded; or null. */
async function decodePortrait(blob: Blob): Promise<CanvasImageSource | null> {
  try {
    if (typeof createImageBitmap === "function") return await createImageBitmap(blob);
    const local = URL.createObjectURL(blob);
    try {
      return await loadImage(local);
    } finally {
      URL.revokeObjectURL(local);
    }
  } catch {
    return null;
  }
}

export async function loadRapAssets(input: {
  /** The portrait's bytes, or null when there is none. Decoded here, never fetched here. */
  portrait: Blob | null;
  /** The cast faces the card will draw. */
  faceUrls: string[];
}): Promise<RapAssets> {
  const portrait = input.portrait
    ? within(decodePortrait(input.portrait), IMAGE_WAIT_MS, null)
    : Promise.resolve(null);
  const unique = [...new Set(input.faceUrls)];
  const faces = await Promise.all(
    unique.map(async (url) => [url, await within(loadImage(url), IMAGE_WAIT_MS, null)] as const),
  );
  const loaded: RapAssets["faces"] = {};
  for (const [url, image] of faces) if (image) loaded[url] = image;
  return { portrait: await portrait, faces: loaded };
}

/** The card, as a PNG. */
export async function renderRapSheetBlob(
  sheet: RapSheet,
  assets: RapAssets,
  format: RapFormat,
): Promise<Blob> {
  await ensureFonts();
  const { width, height } = RAP_FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the card.");
  drawRapSheet(ctx, sheet, assets, format);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The card could not be saved."))),
      "image/png",
    );
  });
}
