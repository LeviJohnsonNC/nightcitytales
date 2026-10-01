/**
 * NCAmp's ten-band equalizer, as numbers.
 *
 * The bands and the presets are the classic ones — the same ten centre
 * frequencies and the same preset names a Winamp 2 user reached for — in
 * decibels, from -12 to +12. What turns them into sound is the filter chain in
 * `musicDirector.ts`; this file only says what the settings are.
 *
 * Pure.
 */

/** Centre frequencies, in Hz, left to right. */
export const EQ_BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000] as const;

/** How far a slider goes either way, in dB. */
export const EQ_RANGE_DB = 12;

export type EqSettings = {
  on: boolean;
  /** Gain before the bands, in dB. */
  preamp: number;
  /** One gain per band, in dB, in `EQ_BANDS` order. */
  bands: number[];
};

export const FLAT_EQ: EqSettings = { on: true, preamp: 0, bands: EQ_BANDS.map(() => 0) };

/** The presets, in dB per band. Values follow the classic set by ear, not by copying a file. */
export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Classical: [0, 0, 0, 0, 0, 0, -4.3, -4.3, -4.3, -5.8],
  Club: [0, 0, 4.8, 3.4, 3.4, 3.4, 1.9, 0, 0, 0],
  Dance: [5.8, 4.3, 1.4, 0, 0, -3.4, -4.3, -4.3, 0, 0],
  "Full Bass": [4.8, 5.8, 5.8, 3.4, 1, -2.4, -4.8, -6.3, -6.7, -6.7],
  "Full Treble": [-5.8, -5.8, -5.8, -2.4, 1.4, 6.7, 9.6, 9.6, 9.6, 10.1],
  Headphones: [2.9, 6.7, 3.4, -2, -1.4, 1, 2.9, 5.8, 7.7, 8.7],
  Live: [-2.9, 0, 2.4, 3.4, 3.4, 3.4, 2.4, 1.4, 1.4, 1.4],
  Party: [4.3, 4.3, 0, 0, 0, 0, 0, 0, 4.3, 4.3],
  Pop: [-1, 2.9, 4.3, 4.8, 3.4, 0, -1.4, -1.4, -1, -1],
  Reggae: [0, 0, 0, -3.4, 0, 3.9, 3.9, 0, 0, 0],
  Rock: [4.8, 2.9, -3.4, -4.8, -2, 2.4, 5.6, 6.7, 6.7, 6.7],
  Soft: [2.9, 1, 0, -1.4, 0, 2.9, 5.8, 6.7, 7.7, 8.2],
  Techno: [4.8, 3.4, 0, -3.4, -2.9, 0, 4.8, 5.6, 5.6, 5.3],
};

export function clampDb(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(-EQ_RANGE_DB, Math.min(EQ_RANGE_DB, Math.round(db * 10) / 10));
}

/** A stored setting, repaired: the right number of bands, every value in range. */
export function normalizeEq(raw: unknown): EqSettings {
  const value = (raw ?? {}) as Partial<EqSettings>;
  const bands = Array.isArray(value.bands) ? value.bands : [];
  return {
    on: value.on !== false,
    preamp: clampDb(Number(value.preamp ?? 0)),
    bands: EQ_BANDS.map((_, i) => clampDb(Number(bands[i] ?? 0))),
  };
}

/** A linear gain for a dB value, for a GainNode. */
export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** "1K", "16K", "600": how a band is labelled under its slider. */
export function bandLabel(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}K` : String(hz);
}
