# Make STAT strength instantly scannable

## Goal
Turn every core STAT display into a compact Stephen Few-style comparison: restrained color, strong ordering, and a redundant icon/shape cue so players can read strengths and weaknesses at a glance without relying on color alone.

## Changes
- Add one shared presentation helper for the requested bands:
  - **2 — Very Bad:** red, downward marker
  - **3 — Bad:** amber, low marker
  - **4–5 — Neutral / Average:** muted neutral, level marker
  - **6 — Good:** cyan, upward marker
  - **7–8 — Very Good:** green, double-up marker
- Use that helper across character creation STAT cards, rolled STAT readouts, template-table values, and saved character sheets.
- Add a small legend beside the first relevant STAT display so the encoding is understandable without cluttering every card.
- Keep labels and numbers dominant; use color only as a narrow accent/background tint rather than decorative neon effects.
- Preserve current click, tooltip, dice, and editing behavior. No rule values or calculations change.

## Verification
- Check values 2 through 8 render in the correct band, including the shared 4–5 band.
- Verify keyboard/touch interactions remain intact.
- Review the STAT grid on desktop and mobile, then confirm tests and the app build remain clean.

## Technical details
- Keep the scale in the feature/presentation layer, not the rules engine, because it changes only visual interpretation.
- Reuse existing semantic palette tokens and Lucide icons; add no hardcoded component colors.
