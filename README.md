# Docere — agent evaluation take-home

Docere is an AI tutoring platform for middle-school computer science. We are
restructuring it from one large model call into a set of small components that
each own one job.

That raises a problem we would like your help with: **how do you tell whether any
of them are any good?**

This repository is a small, runnable skeleton. Your job is to turn it into a
useful evaluation suite.

---

## Setup

```bash
git clone <this repo>
cd docere-agent-eval
node eval/run.js
```

That is the whole setup. Node 18 or newer, no dependencies, no API keys, no
network. The agents in `src/agents/` are offline stubs.

Run one agent:

```bash
node eval/run.js grain.write
node eval/run.js grain.write --verbose
node eval/run.js --json
```

Run the tests:

```bash
npm test
```

---

## The assignment

### 1. Document the agents

Read `docs/agents.md` and the stubs, and write your own inventory of what each
component does. High level — a couple of lines each.

Part of this is deciding which of them are the kind of thing you score against
labelled data, and which are the kind of thing you write correctness tests for.
Those need different treatment and it is worth being explicit about which is
which.

### 2. Build the evaluation suite

Three pieces:

- **A gold standard.** At least 10 cases. See `data/gold/README.md`.
- **A scoring method.** `src/scoring/exactMatch.js` is the baseline. It is
  deliberately poor. Replace or extend it.
- **A runner.** `src/runner.js` and `eval/run.js` already work end to end. Extend
  them as your scoring needs.

### 3. Justify it

Fill in `docs/evaluation-design.md`. Why your cases represent what matters, why
your scoring is right for these agents, and what your assumptions and limitations
are.

We read this at least as closely as the code.

---

## What "good" looks like

**A gold standard someone else could extend.** The test is whether a second
person, given your definition of correctness, would label a new case the same way
you would. If your definition only works in your own head, the dataset is not
reproducible and neither are your results.

**A scoring method that reflects what a mistake actually costs.** This is the part
we care about most. Errors are not all equally bad, the asymmetry is different for
different components, and a metric that treats them as equivalent is measuring
something other than what you want. Tell us how you decided.

**Honesty about limitations.** "I could not find a defensible way to measure this
one" is a good answer if you explain what you tried. Confident numbers you cannot
justify are worse than gaps you can.

**Clarity over cleverness.** No frameworks, no heavy tooling, nothing needing a
GPU. We would rather read 200 lines we understand than 2000 we do not.

### One question we always ask

**How would someone game your scoring method?** If a component were tuned directly
against it, what would it learn to do that raises the score without getting
better? Every metric has an answer to this. Knowing yours is most of the skill.

---

## What is here

```
docs/
  agents.md               what each component does (start here)
  evaluation-design.md    template for your write-up — fill this in
src/
  agents/
    registry.js           the agent interface, and where to register new ones
    grainWrite.js         stub: decides what is worth remembering
    grainSurvey.js        stub: answers a teacher's question across a classroom
    almanac.js            stub: decides what to alert a teacher about
  scoring/
    index.js              scorer registry
    exactMatch.js         the baseline scorer, and why it is inadequate
  runner.js               loads cases, runs agents, scores results
eval/
  run.js                  CLI
data/
  gold/
    README.md             how to write and extend cases
    grain.write/          two worked examples
    grain.survey/         one worked example
    almanac/              two worked examples
tests/
  scoring.test.js         a couple of tests, as a starting point
```

### About the stubs

The three agents are **deterministic, offline, and deliberately imperfect**. They
fail in the ways real components fail: matching on surface phrasing rather than
meaning, ignoring context they were given, applying fixed thresholds without
memory of what they have already said.

You are not being asked to improve them. You are being asked to **measure** them —
and a good suite should make the specific shape of their failures visible, not
just produce a low number.

Their output types differ on purpose. One returns a set, one returns a set with
severities, one returns free text. A single metric will not serve all three well,
and working out what to do about that is part of the exercise.

### About the baseline

`exactMatch` serialises both sides and compares strings. It runs, and it is
almost useless — no partial credit, order-sensitive, literal about wording. It
exists so the suite works on first run and so you have something concrete to
argue with.

Expect low scores on first run. That is the starting condition, not a bug.

---

## Scope

Half a day to a day. If you find yourself building infrastructure, stop and write
the reasoning down instead — we would rather have three components measured
thoughtfully than eleven measured mechanically.

## Submitting

Fork or clone, commit your work, and send us a link. Include your filled-in
`docs/evaluation-design.md`. If anything here was ambiguous, tell us how you read
it and why — noticing the ambiguity is worth more than guessing correctly.

## Data

Everything here is synthetic. Please do not add real conversation data of any
kind.
