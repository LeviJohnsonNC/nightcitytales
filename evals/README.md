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

The eval needs a key for a model it can call. Play uses the Lovable gateway,
but `LOVABLE_API_KEY` cannot be exported from Lovable Cloud, so outside Lovable
the eval calls the same model through a key you own. `runTurn.ts` takes the
first of these it finds:

| Variable                         | Where it goes                            | Notes                                                                           |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`             | openrouter.ai                            | Same model slugs as the gateway (`google/gemini-3.7-flash`), so closest to play |
| `GEMINI_API_KEY`                 | Google AI Studio's OpenAI-compatible API | Free tier; the `google/` prefix is dropped from the slug                        |
| `EVAL_API_KEY` + `EVAL_BASE_URL` | any OpenAI-compatible endpoint           | For anything else                                                               |
| `LOVABLE_API_KEY`                | the Lovable gateway                      | Only exists inside Lovable's own sandbox                                        |

```sh
cp .env.example .env     # fill in one of the keys above
bun run eval             # every scenario and pair, five runs each
REPEAT=5 bun run eval    # more runs (vitest rejects a --repeat flag, so it is a variable)
bun run eval -t job-risky-intent
bun run eval:compare     # the two newest runs, side by side
```

Five runs is the default because fewer cannot tell a change from chance (see
"Comparing two runs"). The runs of a scenario are asked together, but the
calls are paced to `EVAL_RPM` a minute (default 15): a provider limits requests
a minute, and the first live run of this harness lost three scenarios to a new
OpenRouter account's twenty. A full run is about 130 calls, so around nine
minutes at the default. A scenario the model could not be asked is recorded
with its error and left out of any comparison, rather than counted as a check
that stopped running.

`EVAL_MAX_TOKENS` caps a reply. Play sets no cap and neither does the eval, so
the two measure the same thing, but OpenRouter reserves credit for the largest
reply a call might make (65,536 tokens) and refuses one on a small balance long
before the balance is spent. A turn is a few hundred tokens, so a cap of 4096
changes no reply and lets a small balance through.

Bun loads `.env` itself; there is no dotenv step. `GM_MODEL` and `LIFE_MODEL`
pick the models, same as in play — set them if your provider names the model
differently from the gateway. A cloud environment also needs the provider's
host on its allowed list.

In a Claude Code cloud session the key is best stored as a credential on the
environment rather than as a variable: the session's proxy adds it to every
request to `openrouter.ai`, and the key itself never enters the container. Two
things follow. The eval still needs `OPENROUTER_API_KEY` set to pick OpenRouter,
so give it any placeholder and the proxy replaces the header. And Node's
`fetch` ignores `HTTPS_PROXY` unless told otherwise, which sends it around the
proxy and so around the key:

```sh
NODE_USE_ENV_PROXY=1 OPENROUTER_API_KEY=placeholder bun run eval
```

The eval calls the model the way play does, which is WITHOUT strict structured
output (`ai-gateway.server.ts` leaves `supportsStructuredOutputs` off). The
first live run had it on, and under it the model wrote every proposed action as
a JSON string, so the eval reported risky intents never reaching the dice: a
failure of the harness, not of the narrator. When a Job turn comes back as
prose instead of an object, the eval salvages it the way play does rather than
failing the scenario.

The one difference from play is who serves the call. A result that only shows
up through one provider is worth re-running through another before trusting.

## Reading the prose

The checks say whether a turn broke a rule, not whether it was any good, and
the first tuning pass found its three biggest problems by reading rather than
counting: the arrival that reached the player as a one-line log, the bar
described afresh on every turn, the smell-list opener. `TRANSCRIPT=<file>`
writes every turn out in full, with what the player said and what the turn
proposed, so a revision can be read side by side with the one before it:

```sh
TRANSCRIPT=/tmp/after.md REPEAT=2 bun run eval
```

## Comparing two runs

Every run writes `evals/results/<time>.json` (or `RESULTS=<file>`; the folder is
git-ignored): the prompt versions, the model that answered, every turn, and what
each check made of it. `bun run eval:compare` sets the two newest side by side,
or name two files. It prints what got worse first, with what the new run
actually said, then what got better.

A cell is called a regression or an improvement only when Fisher's exact test
says the two counts are unlikely to be the same rate (p < 0.05). Anything else
that moved is listed as **unclear**, with the run to read. This is not
pedantry: the first two runs this was ever used on had identical prompts and
still disagreed, one check going from 3/3 clean to 0/3, which a "half the runs
moved" rule had called a regression that never happened.

It also means the number of runs decides what can be seen. At three a side the
biggest possible swing, 3/3 against 0/3, has p = 0.1 and can never be called.
At five, 5/5 against 0/5 (p = 0.008) and 5/5 against 1/5 (p = 0.048) can. A
comparison of fewer than five runs a side says so at the top and calls
nothing. The logic is `src/features/narration/evalReport.ts`, which CI tests.

To answer "did this revision help": run BEFORE the change, make it, run again,
compare. Keep the first file; it cannot be recreated once the prompt has moved.
If the change is already made, the before-run can come from the commit before it
in a second checkout:

```sh
git worktree add ../nct-before <commit-before> && ln -s "$PWD/node_modules" ../nct-before/node_modules
(cd ../nct-before && bun run eval)     # leaves ../nct-before/evals/results/<time>.json
bun run eval
bun run eval:compare ../nct-before/evals/results/<time>.json evals/results/<time>.json
```

**Comparing across a change to the checks.** Every turn is saved in the file (the
reduced form the checks read, and `raw`, the whole normalized reply), so a run can
be scored again without asking the model:

```sh
bun run eval:rescore evals/results/<run>.json     # writes <run>.rescored.json, marked as such
```

Do this to the older run before comparing a prompt change to it whenever the
checks changed in between. Otherwise a cell that moved might have moved because
the check did, not the prompt. The comparison's header says which file was
re-scored.

A run stops at the first error no retry can fix (a key's total limit, a spent
balance, a bad key) instead of asking every remaining scenario the same
question. OpenRouter keys carry their own limit, separate from the account's
credit: adding credit does not lift a key that has reached its own.

## Replaying real turns

The eval asks a model about invented scenes and costs money per call. Every turn
anyone has actually played is already in the ledger, stamped with the prompt
version and model that wrote it, and scoring it costs nothing:

```sh
bun run eval:replay --file rows.json         # rows exported from campaign_events
bun run eval:replay                          # reads the project's own ledger
bun run eval:replay --since 2026-09-20 --narrator gm --json groups.json
```

Reading the project needs `SUPABASE_URL` and one of:

- `SUPABASE_SERVICE_ROLE_KEY` — every campaign. It bypasses RLS, so keep it on
  your machine and out of commits, logs and browsers.
- `SUPABASE_ACCESS_TOKEN` with `SUPABASE_PUBLISHABLE_KEY` — one signed-in user's
  own campaigns, through RLS.

The report groups turns by narrator, prompt version and model, counts how many
broke each rule (quoting a few), gives the prose length, and sets each version
against the one before it with the same significance test `eval:compare` uses.
A version that ran on a different model is not compared with the one before it,
because the change could be the model.

**What it can and cannot score.** The ledger keeps what the narrator said, not
what it was handed, so only checks that read the prose alone can run: no way in
named, no "What do you do?", no list of smells. The number check needs the
packet to know whether the engine said a figure first, so it appears apart as an
upper bound on figures stated, never as a failure. "Options only when asked"
cannot run at all: a Life turn stores its `actions` whether the narrator offered
them or the engine did (a trip that could not be worked out writes the nearest
real places as cards, in the same shape), so counting them would report the
engine working as the narrator misbehaving.

**It is a lead, not a result.** Two versions were played by different people on
different nights, and the turns of one campaign are more alike than turns of two.
When a version moves, `bun run eval` asks both versions the same questions and is
what confirms it. A failing real turn is also the best source of a new scenario:
copy its situation into `scenarios.ts`.

The turns are your players' private narration. The report quotes short
fragments; do not paste it where it should not go.

## Judging quality

The checks say whether a turn broke a rule. Two turns can both pass every check
and one still be flat, and the cue lists behind checks like `usesTheReading`
are blunt ("a distinct lack of student hesitation" shows youth and matches no
cue). A second model can read two narrations of one scene and say which is
better:

```sh
bun run eval:judge compare before.json after.json [--limit-per-scenario 3] [--scenarios a,b] [--dry]
bun run eval:judge label   before.json after.json --n 30   # writes results/judged/labels.md
bun run eval:judge calibrate evals/results/judged/labels.md
```

`compare` pairs run N of each scenario in `before` with run N in `after`,
judges every pair twice with the order swapped, and counts a win only if it
survives the swap (a judge that names the first text both times is showing
position bias, and that is reported as _inconsistent_, not as a tie). It scores
five criteria that trace to `PRODUCT.md` and the house voice (specific,
restrained, in scene, leaves room, voice) beside an overall verdict, and calls
a change only by an exact sign test over the decided pairs. It also reports how
often the longer text won, because length is the commonest judge bias.

**Set `JUDGE_MODEL` to a different family from the narrator** (the default is
`anthropic/claude-haiku-4.5`; the narrator is Gemini): a model prefers prose
that sounds like itself. Use `--dry` first: it prints the call count before
anything is spent.

**A judge nobody has checked is not evidence.** `label` writes a blind sample
(which side is the change is hidden, and shuffled) for a person to fill in with
`A`, `B` or `tie`; `calibrate` asks the judge the same questions in the same
slots and writes the agreement and Cohen's kappa. Every judged report opens
with whether that has been done for the model in use. Kappa near zero is
chance; about 0.4 is worth reading, 0.6 agrees well.

**Where it stands (30 blind pairs, one labeller, scene intent given to the
judge):** haiku-4.5 kappa 0.19, sonnet-4.5 0.24, sonnet-5.5 0.27, opus-5.5
-0.06. None reaches 0.4, and on 30 pairs the error on a kappa is about ±0.15,
so the models are not distinguishable from each other. Read a judged report as
a prompt to go and read the turns, not as a measurement.

It is never a gate, for the same reason `bun run eval` is not: it costs money
and it is a model's opinion. The scene the judge sees is the scenario's packet
as `scenarios.ts` renders it now (a record does not keep its packet), so judge
runs made close to the change. Reports go to `results/judged/`, a subdirectory,
so `eval:compare` never reads one as a run.

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

| File                                          |                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `scenarios.ts`                                | The turns, built through the shipping renderers from fixture state. No database.  |
| `runTurn.ts`                                  | The model call, and reducing a response to what a check can read.                 |
| `narrator.eval.ts`                            | Scenario × check, with the repeat counting, and the results file.                 |
| `compare.ts`                                  | Two results files, side by side. A thin wrapper.                                  |
| `judge.ts`, `judgeCall.ts`, `pacing.ts`       | The judged layer's CLI and model call, and the pacing both model scripts share.   |
| `../src/features/narration/judge.ts`          | The rubric, verdict parsing, order swap, sign test, calibration. Pure, CI-tested. |
| `../src/features/narration/narratorChecks.ts` | The detectors. Pure, CI-tested.                                                   |
| `../src/features/narration/pairedChecks.ts`   | The comparisons between two variants of a scene. Pure, CI-tested.                 |
| `../src/features/narration/evalReport.ts`     | The results record, and comparing two of them. Pure, CI-tested.                   |

## Too much, and too little

The first eleven checks catch the narrator overreaching: pricing things,
naming a way in, filling a quiet night. With nothing watching the other
direction, every prompt revision could only add a brake, and the game that came
out of it stopped at the door of every bar it was asked to sit in. The
follow-through checks (`goes-where-asked`, `finishes-the-request`,
`stays-put-on-refusal`, `directions-are-real`) catch the narrator doing too
little, and the four `life-*` scenarios at the bottom of `scenarios.ts` replay
the transcript that found it. A prompt change that makes one set pass by
failing the other has not helped.

## Pairs

A single turn can only say whether it broke a rule. It cannot say what a rule
about a DIFFERENCE means: that a 71-year-old man and a 22-year-old woman in the
same scene get the same dice and a different porter, or that a Solo and a
Netrunner in the same office are offered different first moves. A prompt that
ignores the line passes every single-turn check, and so does one that lets it
move a difficulty.

A pair (`PAIRS` in `scenarios.ts`) is the same scene twice, differing in one
input. Each side is held to the ordinary checks, and the two are held to each
other by `pairedChecks.ts`:

- **the difference moved no difficulty and skipped no roll** — a skill whose
  difficulty in every run of one side is above every run of the other, or one
  side always going to the dice while the other never does.
- **the narrator used the difference** — at least half the runs of a side reach
  for one of its authored cue words. A line the model ignores in every run is
  dead weight in the packet. The cues are heuristic words, like a withheld
  truth's tells: read the transcript before trusting a failure. Recorded as a
  rate (runs that showed a cue, out of all runs), so two runs can be compared.
- **the options diverge** — every turn is asked which side its options look
  like. If the difference changed nothing, about half are right by luck; if it
  changed them, nearly all are. The rate is recorded, and whether it beats luck
  is decided by shuffling the labels and asking how often a random split does as
  well (a seeded permutation test, so the same turns always give the same p).
  Needs four runs a side to be able to say anything at all, and at four a single
  odd run is enough to lose it: five, the default, is where it holds up.

A rate cell is a measurement, not a rule: the summary lists it under "rates"
with whether it held, keeps it out of the clean-run totals, and `eval:compare`
tests a change in it like any other count. Its pass or fail is the check's own
verdict. Near the line that verdict can still tip between two runs of the same
prompt (8/10 turns told apart, then 9/10, straddled it) while the count barely
moved; trust the count and the comparison, and read the verdict as a prompt to
look.

A difference smaller than the model's own variation is not a difference, which
is why every comparison is between the runs of one side and the runs of the
other rather than between two turns.

## Adding a scenario

Keep the set small — each one costs a call per repeat, and six scenarios that
each watch for something specific beat twenty that all watch a quiet evening go
by. A new one earns its place by catching something none of the others can.

Only the checks a scenario gives something to measure are run and reported: a
check declares `applies(ctx)`, and `checkApplicability.test.ts` holds the gate to
the check's own early return, so a gate that drifts cannot quietly stop a check
measuring something.

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
