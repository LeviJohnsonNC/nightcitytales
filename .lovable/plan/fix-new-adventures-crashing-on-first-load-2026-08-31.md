# Fix new adventures crashing on first load

## Confirmed cause

The newest adventure was created successfully with its vitals, inventory, cast, and opening ledger entry. The failure happens afterward while rendering the Life screen.

Role-package equipment is persisted using printed display labels rather than canonical catalog IDs. For the newest character, the database contains `Neural Link` and `Sandevistan`, while the rules catalog and play engine require `neural_link` and `sandevistan`. `CarriedKit` performs a strict catalog lookup while the Life screen renders, throws `Unknown cyberware "Neural Link"`, and the route falls into the full-page error boundary shown in the screenshot.

The same persistence mismatch affects package weapons, armor, ammunition, and gear. Those rows do not currently crash this screen because their display lookups are guarded, but package weapons and armor cannot be reliably recognized by the live campaign engine.

## Changes

1. **Save canonical package item IDs going forward**
   - Update character-save payload assembly to resolve every Role-package weapon, armor, ammunition, gear, and cyberware label through the existing package catalog resolver.
   - Persist canonical `item_id`, catalog `kind`, effective slot/location, and the printed quantity already supplied by the package.
   - Preserve the chosen weapon variant as notes; do not invent or alter any rules values.

2. **Repair existing saved characters and campaigns**
   - Add a forward-only database migration mapping currently persisted package labels to their canonical catalog IDs in both character and live-campaign equipment tables.
   - Correct live inventory `kind` and `slot` at the same time so existing package weapons, armor, ammunition, and gear become mechanically visible.
   - Keep IDs that are already canonical unchanged and avoid touching unrelated/custom rows.

3. **Prevent one malformed legacy row from blanking the route**
   - Make the carried-chrome presentation tolerate an unknown catalog value and display the stored value as a fallback.
   - Normalize or safely reject unknown installed chrome before ripperdoc placement calculations, so a legacy row produces a local actionable message rather than a full-page crash.

4. **Regression coverage**
   - Test that Streetrat/Edgerunner package save payloads contain canonical catalog IDs and correct live slots.
   - Test that legacy display-name chrome no longer crashes the carried-kit/Life render path.
   - Verify a fresh adventure reaches `/play/:id`, renders Life, opens its first moment, and recognizes starting weapons, armor, ammunition, and cyberware.

## Technical notes

- Keep catalog-label resolution in the existing pure engine/package-catalog layer.
- Keep database access inside `src/lib/backend/` and use a new forward-only migration; do not rewrite published migrations.
- Regenerate backend types only if the migration changes schema shape (the planned data correction does not require it).
