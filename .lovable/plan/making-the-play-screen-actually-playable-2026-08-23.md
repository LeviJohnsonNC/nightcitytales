# Making the Play Screen Actually Playable

## What's going wrong

I checked the play code and the campaign-start routine. Four real gaps, all in the play layer:

1. **No opening narration.** Starting a campaign writes exactly one ledger line ("Campaign started…" / your run's opener) and stops. The AI GM is only ever called when *you* type something. So the first thing you see is a one-liner instead of the scene.
2. **The mission's own read-aloud text is never shown.** "A Night at the Opera" ships with printed read-aloud copy for the Background beat (the Net 54 Crimewatchers report, the missing women, Rhinemeyer's 2,000eb offer). The engine holds it, the GM prompt can see it, but the screen never renders it and nothing narrates it — which is exactly why "Recover Lucy Rhinemeyer" appears with no explanation of who she is or why you care.
3. **No suggested actions.** The GM already returns structured output each turn, but it has no field for "things you could try", and the UI only offers the free-text box plus the beat-exit buttons in the sidebar.
4. **No way to see your character.** The play screen shows HP / Wound / Humanity / eb and nothing else — no stats, skills, gear, cyberware, or portrait.

## What I understand you want

A solo, AI-run Cyberpunk RED adventure where the app is the GM: it sets the scene in real prose, tells you what you know and why, offers concrete things you could do (while still letting you type anything), and keeps your character sheet a click away. The rules engine keeps owning dice and state; the AI only narrates and parses intent.

## The fix

### 1. Open the scene automatically
When a campaign loads and the ledger has no narration yet, run one GM turn with an opening instruction ("set the scene from this beat's read-aloud and brief; tell the player how they came by this job") and write it to the ledger. Same path on any beat change that arrives without narration, so you never stare at an empty scene.

### 2. Show the briefing
- Render the beat's read-aloud text as a distinct, styled block at the top of the narrative log — the in-world dispatch, visually separate from GM prose.
- Add a collapsible **Job** card in the sidebar: patron, offer (500eb up front, 2,000eb on recovery), and the current beat's stakes, drawn from the mission data. Objectives stop being context-free.

### 3. Options plus free text
- Extend the GM response contract with `suggestedActions`: 3-4 short, concrete, in-fiction options for the current moment (e.g. "Ask the noodle vendor about the missing students", "Case the symphony hall's side entrance"), each optionally tagged with the skill it would lean on.
- Render them as clickable buttons directly above the input box. Clicking one submits it as your intent; the free-text box stays exactly as it is.
- Beat exits (the "Where to" buttons) stay in the sidebar but get relabelled as travel/scene moves so they read differently from moment-to-moment actions.

### 4. Character sheet access
Add a **Sheet** button in the play header that opens a slide-over panel with the full live sheet — portrait, STATs, skills with bases, gear, armour, cyberware, and current vitals — reusing the existing character-sheet rendering. Read-only during play.

## Technical notes

- `src/features/gm/gmResponse.ts`: add `suggestedActions: { label, skill? }[]` to the Zod schema; `gmSystemPrompt.ts` gets a short section telling the GM to always return 3-4 of them and to open a fresh beat from the read-aloud.
- `src/features/play/usePlay.ts`: add an `openScene` step that fires one GM turn when the current beat has no `gm_narration` event, persisted as a normal ledger event so it survives reload and never double-fires.
- `src/features/play/PlayScreen.tsx`: read-aloud block, suggested-action buttons, Job card, Sheet drawer trigger.
- New `src/features/play/JobCard.tsx` and `src/features/play/SheetDrawer.tsx`; the drawer wraps the existing sheet components with live campaign vitals.
- No schema changes and no rules-data changes: everything comes from the existing mission beat graph and `src/data/rules/`. The engine still owns all dice and state.
