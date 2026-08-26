# Make it play great on a phone

No rules, no gameplay, no engine changes. This is layout, touch, and typography work on the Life and Play screens plus a few shared components.

## What's wrong today (from the current code)

- Both play surfaces use `lg:grid-cols-[1fr_20rem]`, so on a phone the whole status rail (HP, wounds, eb, Luck, situations, people, pressure, standing) collapses *below* a tall log. The numbers you check constantly are the hardest thing to reach.
- The log is a fixed-height inner scroller (`min-h-[70vh]` + `overflow-y-auto`) inside a page that also scrolls. On touch this is the classic two-scrollbar trap.
- The action input sits at the bottom of a long column. Typing means scrolling to it every turn, and the on-screen keyboard covers it.
- Skill hints, cost hints, and disposition details are `Tooltip`/`title` only — hover doesn't exist on touch, so that info is simply unreachable.
- Option cards render `sm:grid-cols-3`; on a phone they stack full width but the buttons and small `size="sm"` controls are under the 44px comfortable tap size.
- Body copy and inputs use `text-sm`/`text-xs`; iOS zooms any input under 16px on focus, which jerks the layout.
- `100vh`-style sizing and no safe-area padding means the bottom row can sit under the home indicator.

## The changes

**1. Status where you can reach it (biggest win)**
On small screens, turn the sidebar into a compact sticky header strip at the top of the screen: HP · wound · Humanity · eb · Luck as a single condensed row, tappable to expand a sheet containing the full rail (Situations, People, Pressure, Standing). Desktop keeps the existing right rail untouched.

**2. One scroll, not two**
On small screens drop the inner `overflow-y-auto` and fixed min-height on the log: let the page scroll naturally, keep auto-scroll-to-latest. Desktop keeps the current column behaviour.

**3. Input docked to the thumb**
On small screens the input bar becomes a sticky bottom bar with a safe-area inset, backed by an opaque surface so text doesn't bleed through. Uses dynamic viewport units so the keyboard doesn't hide it. "Act" and "Options?" sit side by side, both at full tap height.

**4. Touch-reachable info**
Where a tooltip is the only carrier of information (skill name/base on action cards, ask blurbs on the hook card, disposition numbers), also expose it on tap — a popover on touch, tooltip on pointer devices. No content changes, just reachability.

**5. Tap targets and type scale**
Minimum 44px height on all play-screen buttons, steppers, and the Luck control; 16px minimum font-size on every text input/textarea to kill iOS zoom; slightly larger body line-height for narration so long GM prose stays readable at phone width.

**6. Cards that fit 393px**
Check card, combat card, death save, hook card and job card: allow numbers/labels to wrap instead of overflowing, stack their button rows, and keep the payout/DV figures on their own line. Character sheet drawer already goes full-width on mobile; give it safe-area padding and a bigger close target.

## Technical notes

- Touched files: `src/features/life/LifeScreen.tsx`, `src/features/play/PlayScreen.tsx`, `src/features/play/{CheckCard,CombatCard,DeathSaveCard,JobCard,LuckStepper,SheetDrawer}.tsx`, plus small utility additions in `src/styles.css`.
- Add `viewport-fit=cover` to the root viewport meta so safe-area insets apply.
- Purely presentational: no changes to `src/engine/*`, `src/lib/backend/*`, hooks (`useLife`, `usePlay`), prompts, or any rules data.
- Mobile branches are Tailwind breakpoint variants (`lg:` for the existing desktop behaviour), so desktop layout is unchanged. `useIsMobile` is used only where a structural swap can't be expressed in CSS.
- Verified with Playwright at 393x852 across Life, Play, a pending check, and the sheet drawer.
