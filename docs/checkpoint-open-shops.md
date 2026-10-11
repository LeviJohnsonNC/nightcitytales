# Open shops / wet street — 2026-10-11

Base6ed14c22 includes merged PR357 and the independent shopping PR358.
Implementation586db45d, branch codex/open-shops-wet-street. Levi reviews/merges.

The existing repair entrance now shows a full room and clear aisle beneath a raised
shutter. Door positions and widths stay saved-scene authoritative. Display recesses
are fitted to solid spans beside doors, with a high work counter and lower parts
bay; their clipped image and light planes share depth. The market's existing door
opens under its curtain. These are shallow facade presentations, not new rooms or
traversable geometry. Full and retained-wall views share the same painters.

Repair spills use each actual opening's span. The market doorway joins the existing
emitter-only reflection clip. Wall washes remain excluded. Shop picture gain is
separate from the blade, and the cyan sign pool is more restrained. Wetness keeps
world coordinates and union-road gutters, but larger depressions join the patches.
Broken incident highlights retain source shadows and destruction state; paving has
less highlight response than asphalt. No uniform incident sheen was introduced.

New image: public/images/architecture/repair-open-room-v1.webp (512x768), generated
with the built-in image tool. Prompt: straight-on portrait electronics workshop
interior, clear central aisle, shelves on left, workbench on right, warm tungsten,
dark corners, no exterior, people, text or bloom. Converted with Sharp to512px wide,
WebP quality92, original retained at:
/Users/levijohnson/.codex/generated_images/01a12b66-843f-7a70-86c1-77681c3d2c1f/exec-2d217725-04ef-4f80-9b84-c1b4db90f534.png
Existing repair art remains available as the no-asset fallback.

Two local seed8 iterations passed and were visually inspected. The first had
excessive bright paving highlights; these were reduced, and the doorway's cropped
shelf was replaced with the room. Final targeted22tests pass. Full validation and
paired before/after review are tracked in the handoff and PR rather than asserted
here before completion. Scene fixtures, geometry, combat rules and other environment
recipes are untouched. This is not a reference-parity claim.
