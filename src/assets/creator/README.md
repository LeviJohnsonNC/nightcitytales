# Character-creation art and music

Drop the finished files here under the names in `docs/art-style.md` (images)
and `docs/soundtrack.md` (music). `uploadedAsset` in
`src/features/chargen/art.ts` finds them by name, so nothing else needs
changing, and a slot with no file keeps its plain look or stays silent.

- Images: `.png`, `.jpg` or `.webp`. The extension does not matter, and neither
  does the case: `Scene-Meet.PNG` fills `scene-meet`.
- Music: `.mp3` (or `.m4a`, `.ogg`, `.wav`). `music-meet.wav` fills
  `music-meet.mp3`.

Vite bundles whatever is here, so keep files a reasonable size: an image around
2000px wide, a track as an mp3 rather than a wav.
