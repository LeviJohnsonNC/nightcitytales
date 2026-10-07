# Street surface browser evidence

Actual connected-Chrome screenshots of the shared shipping renderer. JPEGs are
quality-88 derivatives of untouched PNG captures; no compositing or recolouring.

- `seed7-play-before/after`: matched normal play camera, actors, night and lights
  on, page scrolled to the battlefield; before is merged main `95c90722`.
- `seed7-close-before/after`: scenery, `cam=0,60,2.2`, night and lights on. Slight
  page-scroll variation; the camera and scale are unchanged.
- `seed7-neutral-after`: same closer camera, night disabled; inspect albedo.
- `seed7-lights-off-after`, `seed7-reveal-after`: normal play diagnostic states.
- `seed0-play-after`, `seed8-play-after`: alternate placements at normal play.
- `seed8-destroyed-after`: destroyed cover and its resulting ground visibility.
- `seed7-restored-after`: saved review restored after seed/damage changes.

Viewport 682 × 660. Controls may scroll into view on interaction. Reflections
are off/not built throughout. See `../../checkpoint-street-surface.md` for the
critique, verification scope and remaining priorities.
