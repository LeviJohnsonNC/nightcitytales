# Residential finish — connected Chrome evidence

Actual local application captures at 2036 × 1048, using the existing Vite server
on `http://127.0.0.1:8080/scene-review`. JPEG copies of original PNG screenshots;
no compositing, recolouring or synthetic scene rendering.

- `seed7-play-before/after`: normal play framing, actors, night, lights on.
- `seed7-close-before/after`: scenery-only, `cam=-290,60,2.6`, night.
- `seed7-neutral-before/after`: same camera, night off.
- `seed{0,7,8}-lights-off-after`: normal play framing, lights off.
- `seed{0,7,8}-reveal-after`: normal play framing, reveal on (seed 7 mixed damage).
- `seed0-play-after`, `seed8-play-after`: alternate placements at play framing.
- `seed7-restored-after`: frozen review snapshot after save → Garage → load;
  nine destroyed cover sections, original seed/layout retained.
- `seed7-targeting-after`: lookout blocked by sedan engine block after restoration.

Seed 0's residential block is behind the action; reveal correctly leaves that
unoccluding block standing. Seed 8's residential block lies in the foreground,
so the normal framing shows only part of it. Seed 7 is the matched facade view.

Judgment: stronger storey rhythm and sill depth at play zoom, quieter furnished
upper windows, consistent annex materials, shop still primary. Base brick detail
and curtain folds mostly resolve closer in. Large roof fields remain plain.
Full acceptance is a human visual judgment; passing tests does not establish it.
