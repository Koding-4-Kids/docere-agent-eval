# Evaluation design

**This file is a template. Fill it in — it is one of the things we read most
closely.**

A working evaluation suite with no reasoning behind it tells us less than a
partial one with clear reasoning. The code shows us that you can build. This shows
us how you decide.

---

## 1. Agent inventory

Your own outline of the components, from reading `docs/agents.md` and the stubs.

For each one, briefly: what it does, and whether you consider it something that
needs **scoring against labelled data** or **correctness testing**. Say why. If
you disagree with how we have grouped them, say that too — we would rather hear
it.

## 2. What I chose to evaluate, and what I left out

You are not expected to cover everything. Three components covered well is a
better answer than eleven covered thinly.

Tell us which you picked and why. "These were the ones where I could define
correctness confidently" is a perfectly good reason. So is "this one looked
important but I could not find a defensible way to measure it" — that is a real
finding, not a gap.

## 3. The gold standard

- What your cases cover, and why that represents what matters
- How you decided what the right answer was in each case
- Which cases you found hardest to label, and what that revealed
- What is **not** represented, and what that means for how far the numbers
  generalise

## 4. Scoring

- What you measure, and why that is the right thing for these agents
- How you combine multiple measures into one number, if you do
- **What a mistake costs.** This is the part we care about most. Not every error is
  equally bad, the asymmetry differs by agent, and a scoring method that treats
  them as equivalent is measuring something other than what you want.
- How you handle the awkward cases: empty expectations, free-text output, partial
  matches, ties

## 5. Results

Numbers from your runner against the stubs. Then, more usefully: what the numbers
told you about where the stubs fail. A scoring method that produces a number but
no insight has not earned its place.

## 6. Limitations and assumptions

Where you had to guess, what you assumed, and what would change if the assumption
were wrong.

Also: how would someone game your scoring method? If an agent were optimised
directly against it, what would it learn to do that looks like improvement but is
not? We are unusually interested in this one.

## 7. What you would do next

With another week, what would you build, and what would you want from us?
