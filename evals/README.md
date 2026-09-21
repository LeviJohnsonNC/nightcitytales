# Evals

Whether a prompt change helped.

Until this existed the answer was unobtainable. The two narrator prompts had
been revised about nineteen times between them with nothing measuring any of it,
and every prompt test in the repo asserts a substring of a string the repo built
itself — no test has ever called a model. So a revision that made narration
worse looked exactly like one that made it better.

This does not fix that on its own. It makes the mechanically checkable half
checkable, which is the half that catches the failures this project cares most
about: a narrator pricing something, naming a difficulty, inventing a person, or
stating a fact the character has not found.

## Running it

```sh
cp .env.example .env     # fill in LOVABLE_API_KEY
bun run eval             # every scenario, once each
bun run eval -- --repeat 3
bun run eval -- -t job-risky-intent
```

Bun loads `.env` itself; there is no dotenv step. `GM_MODEL` and `LIFE_MODEL`
pick the models, same as in play.

It prints the call count it is about to make before it makes it, so a
`--repeat 40` typo is visible rather than expensive. One scenario is one turn:
roughly 8–10k tokens in, 1k out.

## Reading a failure

A check reports a count over repeats and quotes what the turn actually said:

```
FAIL  life-prices-nothing > stated no number the engine did not give it
  2/3 runs passed
  rule: PRODUCT.md: "A number appears in prose that no engine module produced."
    run 2: "5eb" (money the packet never states)
```

The count matters more than the pass. A model is nondeterministic, so one run is
not a verdict — a check that trips one time in three is the finding worth having,
and a boolean would have hidden it. The quote matters for the same reason: a
count with no quote sends you back to the model to reproduce it, which is the
opposite of what an eval is for.

## Why it is not in CI

It costs money per run, needs a key CI does not have, and can go red because a
model had an off day. The repo already takes this position about `supabase/replay/`:
a known-red check teaches people to ignore checks.

The separation is structural rather than a runtime guard. `vitest.config.ts`
includes `src/**` only, and these files live outside `src/` and end in `.eval.ts`,
so `bun run test` cannot pick them up. A `skipIf(!process.env.LOVABLE_API_KEY)`
would have worked right until someone ran the suite with a populated `.env` and
quietly paid for it.

**The checks themselves do run in CI, for free.**
`src/features/narration/narratorChecks.ts` is pure, and
`narratorChecks.test.ts` runs every detector against hand-written prose on every
push. That is the half most likely to be wrong: a detector with a sloppy pattern
either never fires — and the eval reports a clean sweep forever — or fires on
everything, and the report becomes noise nobody reads. Both look like a working
eval from the outside, so each check is tested in both directions: prose that
must trip it, and prose that must not.

## What is here

| File                                          |                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `scenarios.ts`                                | The turns, built through the shipping renderers from fixture state. No database. |
| `runTurn.ts`                                  | The model call, and reducing a response to what a check can read.                |
| `narrator.eval.ts`                            | Scenario × check, with the repeat counting.                                      |
| `../src/features/narration/narratorChecks.ts` | The detectors. Pure, CI-tested.                                                  |

## Adding a scenario

Keep the set small — each one costs a call per repeat, and six scenarios that
each watch for something specific beat twenty that all watch a quiet evening go
by. A new one earns its place by catching something none of the others can.

`expect` is what the checks cannot work out for themselves: whether the player
asked for options, whether the intent was risky, whether the evening was rolled
quiet. Get one wrong and the check is measuring the wrong thing rather than
failing, which is the quiet way an eval stops being true.

`withheldTruths` carries authored `tells` rather than inferring them. The first
version pulled the long words out of a truth's own sentence and wanted all of
them, which a model defeats by paraphrasing: it leaked "Kenbishi Holdings" and
"Arasaka" in one breath while the check held out for "through" and "called".
Only the person writing the scenario knows which nouns would give a fact away.

## Known gap

`runTurn.ts` restates four fields of the gateway call — model, schema, system,
prompt — because `gmTurn.server.ts` and `lifeTurn.server.ts` are server
functions behind auth middleware and cannot be called from a script. Everything
else is imported from them: the same prompts, the same wire schemas, the same
normalizers. If the real call ever grows a `temperature` or a `maxTokens`, it
has to be added here too, or the eval stops measuring what plays.
