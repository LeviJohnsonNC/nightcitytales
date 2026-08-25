# What's left of the Life plan

The Life loop ships end-to-end: situations derive from real state, the model only dresses them, actions cost time and money through the engine, and a job can only start from an explicit **Take the job**. Four pieces of the plan are still missing, and two of them break the loop's promise once a job ends.

## 1. The return road: `aftermath` → `life` (the important one)

Today the job screen never touches `campaigns.phase`. When a job closes it settles the payout and I.P., then offers the next job straight away — so once you take one job you never come back to Life, and the phase column stops meaning anything.

To fix:

- Job wrap-up moves the phase `job → aftermath` instead of immediately offering the next mission.
- The wrap-up card becomes the aftermath screen: payout, I.P. spend, what it cost you (wounds, spent ammo, chewed armor), and one button — "Back to the street".
- That button moves `aftermath → life` and clears the mission runtime. The next job arrives as a hook, never as an automatic next mission.
- The character's condition carries over untouched, which is exactly what seeds the first Life turn's needs.
- Death keeps its existing ending — no aftermath, no return.

## 2. Time passes during a job, not only in Life

`advanceClock` exists and Life spends it, but job play never advances the clock, so a three-hour firefight takes zero minutes and rent never comes due while you're working. Job beats and downtime rest route through the same single clock writer Life uses, with beat-scale costs (a scene, a drive, a night) drawn from the existing `TIME_COSTS` table.

## 3. Freeform Life actions hit the legality gate

The capability snapshot is already sent to the Life model, but `judgeAction` isn't run on what comes back — so a Life turn is the one place a proposal can still slip past the gate the job loop enforces. Run every Life proposal that spends money, uses an item, or fires a weapon through `judgeAction` on the snapshot, and narrate a refusal in fiction ("the pocket comes up empty") exactly as the job loop does.

## 4. Downtime folded into Life

`DowntimePanel` still exists as a separate menu doing rest / pay bills / repair armor. Life actions of those kinds should call the same `useDowntime` operations so there is one implementation of resting and paying rent, and the standalone panel stops being a parallel between-jobs interface.

## Explicitly deferred (from the plan's own "first slice")

- Opportunity-category situations (the mostly AI-authored ones).
- Richer relationship arcs beyond the current "this person has gone quiet" generator.
- Hidden-clock reveals.

These wait until the loop is proven; nothing else depends on them.

## Technical notes

- Phase moves stay authoritative through `nextPhase` in `src/engine/phase.ts`; no new transition may be emitted by a model.
- Aftermath work lives in `src/features/play/usePlay.ts` (wrap-up) plus a small aftermath view; the existing settlement functions are reused unchanged.
- No rules values are invented: time costs remain documented app pacing constants, and payout, I.P., healing and repair keep coming from `/src/data/rules/` through the engine.
- New behaviour gets tests alongside the existing phase, clock and life suites.
