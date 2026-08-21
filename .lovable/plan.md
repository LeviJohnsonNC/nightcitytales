# Skills step: make illegal moves impossible

Today the Skills step lets you push a Skill to 7, overspend the budget, or drop a Basic Skill below the floor, and only afterwards tells you off in a red list. Instead the controls themselves will refuse: if a move would break a rule, the button is disabled with a short reason, so the sheet is always legal.

## Rules enforced at the control (all read from the rules data, nothing hardcoded)

- **+ button** is disabled when the Skill is already at the maximum Level, or when the next Level costs more points than you have left (×2 Skills need 2).
- **− button** is disabled at the Skill's floor: Rank 2 for a Basic Skill, the Edgerunner minimum for Edgerunner Role Skills, 0 otherwise.
- **Add (Complete Package)** is disabled when you can't afford the starting Level, when the Skill is already on the sheet, or when a specialization is required and the box is empty.
- **Remove** stays blocked for Basic Skills and the granted Cultural Origin Language (already the case).
- Edgerunner keeps its Role-only list, so off-list Skills can never be added.
- Every disabled control gets a tooltip/title saying why ("No Skill Points left", "Maximum Skill Level is 6", "Basic Skills must be at least 2").

## What replaces the red error list

The remaining budget counter stays, and the panel keeps one status line — but since over-cap and overspend can no longer happen, the only message left is the honest "You have N Skill Points left to spend", shown as guidance rather than an error. Once it hits zero the line turns to the green "you can move on" state. The step's validation gate is unchanged, so Review still guarantees correctness.

## Technical notes

- New pure helper in `src/engine/skillAllocation.ts`: `skillEntryLimits({ method, roleId, entries, entry })` returning `{ min, max, canIncrease, canDecrease, reason }`, plus `canAddSkillEntry(...)`. All limits derive from `SKILL_PACKAGE_RULES` and `SKILL_RULES.basicSkillMinimum`; max level is `min(rules.maxLevel, currentLevel + floor(pointsRemaining / cost per level))`. No React, no new constants.
- `SkillsPanel.tsx` (`SkillRow`, `CategoryGroups`, `EdgerunnerBranch`, `CompletePackageBranch`) passes those limits down and disables the ± / Add buttons; `setLevel` also clamps as a second line of defence.
- Unit tests added in `src/engine/__tests__/skillAllocation.test.ts` for the affordability cap, the maximum cap, and the Basic Skill floor.
