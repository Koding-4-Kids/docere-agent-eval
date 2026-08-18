# The gold standard

A gold standard is a set of cases where a human has decided what the right answer
is. Everything the evaluation suite reports is measured against it, so it is the
most important thing in this repository — a scoring method built on a weak gold
standard produces confident numbers about nothing.

## Layout

```
data/gold/
  <agent-id>/
    <case-id>.json
```

The folder name must match the agent's `id` in `src/agents/registry.js`. The
runner picks up every `.json` file in the folder.

## Case format

```json
{
  "id":       "conv-001",
  "scorer":   "exactMatch",
  "notes":    "Why this case exists and why the expectation is what it is.",
  "input":    { },
  "expected": { }
}
```

- **`input`** is passed straight to `agent.run()`. It should look like what the
  agent receives in production, not a convenient shape for testing.
- **`expected`** is your judgement of the right answer.
- **`scorer`** selects which scorer to use, so a set-valued agent and a free-text
  agent can be measured differently.
- **`notes`** is read by no code at all. It is required anyway. If you cannot say
  why a case exists, it probably should not.

## What we are looking for

**At least 10 cases.** More matters less than range.

**Range in what the cases test, not just how many there are.** A set of ten cases
that all look alike gives you one measurement repeated ten times. Some things
worth deliberately including:

- Cases where the correct answer is **nothing at all**. These are the only thing
  that detects an agent padding its output, and they are the ones most often left
  out.
- Cases with **one** correct item buried in plenty of plausible-looking material.
- Cases with **several** correct items, so an agent that finds the obvious one and
  stops gets caught.
- Cases sitting **right on the boundary** of your own definition. These are where
  two people labelling independently would most likely disagree — which makes
  them the best test of whether your definition is actually usable by someone
  other than its author.

**Spread in the expected quantity.** If every case expects two items, an agent
that always returns two looks perfect while having learned nothing.

## Extending it

Adding a case is adding a file. No registration step.

If you find yourself wanting to change an expectation because an agent keeps
getting it wrong, stop and work out which of the two is actually wrong. Editing
the gold standard to match the agent is the one move that invalidates every
number the suite produces.

## Data

Everything in this repository is synthetic. Do not add real student
conversations — not de-identified ones either. Write your own examples.
