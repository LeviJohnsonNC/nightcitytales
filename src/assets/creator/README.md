# Character-creation art and music

Drop the finished files here under the names in `docs/art-style.md` (images)
and `docs/soundtrack.md` (music). `uploadedAsset` in
`src/features/chargen/art.ts` finds them by name, so nothing else needs
changing, and a slot with no file keeps its plain look or stays silent.

- Images: `.png`, `.jpg` or `.webp`. The extension does not matter, and neither
  does the case: `Scene-Meet.PNG` fills `scene-meet`.
- Music: `.mp3` (or `.m4a`, `.ogg`, `.wav`). `music-meet.wav` fills
  `music-meet.mp3`.

Vite bundles whatever is here, so keep files a reasonable size: a track as an
mp3 or m4a rather than a wav, and an image as a webp. The first set came in as
2MB PNGs and went out as 200KB webps at quality 82 with no visible difference
(`sharp(file).webp({ quality: 82 })`). Remove the PNG when you convert it: two
files with the same name fill the slot with whichever loads last.
