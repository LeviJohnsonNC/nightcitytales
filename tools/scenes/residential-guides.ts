/** Picasso's measured registration cards; these are diagrams, never runtime art. */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const out = "docs/residential-finish/guides";
await mkdir(out, { recursive: true });
// buildingFaces.ts: opening 1.4 x 1.2 m, frame 0.05 m each side.
// Inner glass is 1.3 x 1.1 m. 720 px/m makes an integer crop at 1024 square.
const svg = (body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${body}</svg>`);
await sharp(
  svg(
    '<rect width="1024" height="1024" fill="#404040"/><rect x="44" y="116" width="936" height="792" fill="#b8b8b8"/>',
  ),
)
  .png()
  .toFile(`${out}/home-window-layout.png`);

// One 2 m square tile: eight 25 cm pitches across, 24 courses up (8.33 cm).
// A scale card, not a generation mask: the final brick fills the complete square.
const courses = Array.from({ length: 24 }, (_, row) => {
  const y = (row * 1024) / 24;
  const offset = row % 2 ? -64 : 0;
  return (
    `<path d="M0 ${y}H1024"/>` +
    Array.from({ length: 9 }, (_, col) => {
      const x = offset + col * 128;
      return `<path d="M${x} ${y}v${1024 / 24}"/>`;
    }).join("")
  );
}).join("");
await sharp(
  svg(
    `<rect width="1024" height="1024" fill="#b8b8b8"/><g stroke="#666" stroke-width="4" fill="none">${courses}</g>`,
  ),
)
  .png()
  .toFile(`${out}/home-masonry-scale.png`);
console.log(`Two 1024-square guides written to ${out}`);
