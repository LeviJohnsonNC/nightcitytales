/** Text the descent writes a character at a time. Pure. */

/** How many characters of `text` have been typed `ms` after `start`, at `cps` per second. */
export function typed(text: string, ms: number, start: number, cps = 26): string {
  const count = Math.floor(Math.max(0, ms - start) * (cps / 1000));
  return text.slice(0, Math.min(text.length, count));
}

const SCRAMBLE = "XZKRMNWHBQ0123456789";

/** Text that decodes into place, the way a name does on a file. */
export function scrambled(text: string, progress: number, seed: number): string {
  const settled = Math.floor(text.length * Math.min(1, Math.max(0, progress)));
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (i < settled || ch === " ") out += ch;
    else out += SCRAMBLE[(i * 7 + seed) % SCRAMBLE.length];
  }
  return out;
}
