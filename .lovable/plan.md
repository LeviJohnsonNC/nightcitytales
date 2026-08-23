# Improvement Points at end of session

Turn the IP table you gave me into rules data, let the engine do the arithmetic, and pay IP out on the wrap-up screen — with the GM judging standout play and the player naming their playstyles.

## 1. The table becomes rules data

A new `src/data/rules/ip-awards.json` transcribes the table verbatim: eight tiers (10, 20, 30, 40, 50, 60, 70, 80), each with the descriptor text for the five columns — Group, Warrior, Socializer, Explorer, Roleplayer. Nothing is invented; the descriptors are the ones you pasted, and they double as the criteria the GM reads when judging.

## 2. The award rule, in the engine

A new `src/engine/improvementPoints.ts` implements exactly what you described:

- Mission finished (success or failure): the award is the Group column tier.
- Mission not finished: the award is the better of the player's Primary and Secondary Playstyle tier.
- Either way, if the GM judges a standout moment in any playstyle at a higher tier, that higher value wins.

The final award is simply the highest applicable tier value. Pure functions, fully unit tested, no React and no backend.

## 3. Who decides what

- **Playstyles** — at the end of the session the player picks a Primary and a Secondary Playstyle on the wrap-up card (Warrior / Socializer / Explorer / Roleplayer). Nothing new at character creation.
- **Tiers and standout** — the AI GM. When a job resolves (or the character dies), the GM is asked once for an IP judgement: a Group tier with a one-line justification, and optionally a standout playstyle plus its tier and reason. The GM chooses tiers by matching the session against the printed descriptors, which are included in its context. The engine, not the GM, then computes the number.

## 4. The wrap-up screen

The end-of-job card gains an IP step:

1. Pick Primary and Secondary Playstyle.
2. "Tally IP" — the GM's judgement comes back and the card shows the group tier, the standout (if any), the GM's short reasoning, and the final IP number.
3. The award is written to the campaign ledger and added to the character's permanent IP total, alongside the eurobucks payout that already happens.

Death works the same way: the mission is unfinished, so the award comes from the playstyle columns.

## 5. Where the number lives

Characters currently have nowhere to store IP — the sheet just prints 0. A migration adds an IP total to the character's finance record and an "IP awarded" field to the campaign so a job can only pay out once. The character sheet and roster detail then show the real total instead of a hardcoded zero.

## Technical notes

- `src/data/rules/ip-awards.json` → typed access via `IP_AWARDS` in `src/engine/rulesData.ts`; `IMPROVEMENT_POINTS` stays as is.
- `src/engine/improvementPoints.ts`: `IpPlaystyle` type, `ipTierValues()`, `awardImprovementPoints({ missionFinished, groupTier, primary, secondary, playstyleTier, standout })` returning `{ ip, source }`. Exported from `src/engine/index.ts`; tests in `src/engine/__tests__/improvementPoints.test.ts`.
- GM prompt bumps to v1.5.0 with an `IP JUDGEMENT` mode; `src/features/gm/gmResponse.ts` gains an `ip_judgement` schema (`group_tier`, `standout?: { playstyle, tier, reason }`, `reason`) validated against the eight legal tier values. A new server-function call in `src/features/gm/gmTurn.server.ts` runs this single-shot judgement with `CYBERPUNK_STYLE_GUIDE` prepended as usual.
- `settleMission` and `settleDeath` in `src/features/play/usePlay.ts` stop short of finalising; a new `settleIp(playstyles)` mutation runs the judgement, computes the award, appends an `ip_awarded` ledger event, updates `campaigns.ip_awarded`, and increments `character_finance.improvement_points`.
- Migration: `ALTER TABLE public.character_finance ADD COLUMN improvement_points integer NOT NULL DEFAULT 0;` and `ALTER TABLE public.campaigns ADD COLUMN ip_awarded integer;` (null = not yet tallied). Existing grants and RLS cover both.
- `WrapUpCard` in `PlayScreen.tsx` gains the playstyle selectors and the tally result; `CharacterSheet.tsx` reads the stored total instead of `startingValue`.
