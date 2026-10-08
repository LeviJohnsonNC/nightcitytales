/** Import the immutable returned paintings. Registration is handled in afterRainArt.ts. */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
const out = "public/images/after-rain";
await mkdir(out, { recursive: true });
const ids = [
  "signal-r0",
  "signal-r90",
  "transit-r0",
  "transit-r90",
  "repair-shutter",
  "residential-door",
  "market-services",
];
const report = [];
for (const id of ids) {
  const { data, info } = await sharp(`src/assets/creator/${id}.png`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== 1024 || info.height !== 1536) throw Error(`${id}: unexpected canvas`);
  const rgba = Buffer.from(data),
    light = Buffer.alloc(data.length);
  let left = 1024,
    top = 1536,
    right = 0,
    bottom = 0;
  for (let y = 0; y < 1536; y++)
    for (let x = 0; x < 1024; x++) {
      const i = (y * 1024 + x) * 4,
        a = data[i + 3]!;
      // The returned halo is very low-alpha outside the object. Keep solid-edge antialiasing.
      rgba[i + 3] = a < 40 ? 0 : Math.round(Math.min(1, (a - 40) / 160) * 255);
      if (rgba[i + 3]! > 32) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
      if (id.startsWith("signal"))
        for (let c = 0; c < 3; c++) rgba[i + c] = Math.min(255, data[i + c]! * 1.45);
      let mask = false,
        gain = 1;
      if (id.startsWith("transit"))
        mask = data[i + 2]! > data[i]! * 1.32 && data[i + 1]! > data[i]! * 1.2 && data[i + 2]! > 65;
      if (id.startsWith("signal"))
        mask = data[i]! > data[i + 1]! * 1.7 && data[i]! > data[i + 2]! * 1.6 && data[i]! > 120;
      if (id === "residential-door") {
        mask = x > 252 && x < 747 && y > 392 && y < 947 && !(x > 490 && x < 533);
        gain = 1.8;
      }
      if (mask) {
        for (let c = 0; c < 3; c++) light[i + c] = Math.min(255, data[i + c]! * gain);
        light[i + 3] = rgba[i + 3]!;
      }
    }
  const crop =
    id.startsWith("signal") || id.startsWith("transit")
      ? { left: 0, top: 0, width: 1024, height: 1536 }
      : { left, top, width: right - left + 1, height: bottom - top + 1 };
  for (const [suffix, bytes] of [
    ["", rgba],
    ["-emission", light],
  ] as const) {
    if (suffix && (id === "repair-shutter" || id === "market-services")) continue;
    await sharp(bytes, { raw: { width: 1024, height: 1536, channels: 4 } })
      .extract(crop)
      .resize({ width: 512 })
      .webp({ quality: 94, alphaQuality: 100 })
      .toFile(`${out}/${id}${suffix}.webp`);
  }
  report.push({ id, crop });
}
await writeFile(
  "docs/night-market-after-rain/import-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(report);
