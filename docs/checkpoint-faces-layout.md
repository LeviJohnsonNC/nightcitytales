# Faces in the text: the layout pass

Second half of the faces work. The first half (PR #374, #375) made the pictures
TRUE: the narrator is told who it is writing about, and the engine decides who is
in a room before the narrator writes. This makes them BELONG on the page.

## What changed

- **One "Here" row per scene** (`life/SceneFaces.tsx`, decided by `life/sceneFaces.ts`)
  sits between the place picture and the prose. In order: the people the current
  passage names (only those the engine has at this place, `castHere`) and the
  walk-ons the narrator tagged this turn. A role the place merely has, which the
  passage never brings in, is not shown. Captions: a name, or a walk-on's role.
  Each once, at most six. The "Earlier adventure" bar sits above the whole scene. It scrolls sideways
  on a phone rather than wrapping.
- **One face plate** (`cast/FacePlate.tsx`): the Counter's violet backing, the picture
  anchored to the head, an optional ring, initials when there is no picture. The
  keeper behind a counter, a person in the room, a walk-on and the name card all use it.
- **The ring is the People rail's.** A face the character knows wears the same
  cold-to-warm disposition ring (`hud/hudModel.ts` `RING`), so a face means the same
  thing in both places.
- **Names are text again.** `NpcName` no longer puts a thumbnail in front of every
  mention. A mouse resting on a person's name raises a small card (face, role, how
  they read); a tap still opens the dossier, because a touch screen has no hover.
- **Life's current turn has no strip under the paragraph.** The row replaced it.
  Scrollback keeps `WalkOnStrip`, now built from the same pieces. A Job's pinned latest
  turn has the same row (people its narration names, walk-ons it tagged; not the place's
  standing roles, because the beat decides who is in a scene); the Job journal keeps strips.

## Checked, and not checked

Checked in Chromium from a scratch route that rendered the real components (not
committed): the row at 900 and 390 px with no script error and no sideways page
scroll; the hover card appearing after a short rest, closing on leave and on Escape,
opening on keyboard focus; a click opening the dossier. The unit suite holds the
decision (`sceneFaces.test.ts`) and the markup (`cast/__tests__/faces.test.tsx`).

NOT checked: the signed-in game. `LifeScreen` needs a Supabase session, so the row
has not been seen in a real campaign, on a real turn, over a real scene picture.
That is the remaining gate.

## Limits

- The row is derived on every render from the current narration; after a reload with
  no current narration it shows nothing.
- Faces from earlier scenes are not kept in the scrollback beyond the collapsed strip.
- Hover cards are mouse only. Touch gets the dossier on tap.
- Each walk-on role still has two faces (debt 27).
