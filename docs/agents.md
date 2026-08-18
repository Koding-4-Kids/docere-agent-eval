# Agent inventory

Docere is an AI tutoring platform for middle-school computer science. Rather than
one large model call doing everything, the system is being restructured into a
set of small components that each own one job and hand structured context to each
other.

This document is the **starting point, not the answer**. Part of the assignment is
to produce your own inventory — including judgements we have deliberately left
open below.

---

## A note on what counts as an agent

Not everything in this list is an agent, and the distinction matters for how you
evaluate it.

A useful working definition:

> An agent makes a judgement call that could have gone differently, using tools,
> and can be scored on whether the judgement was good.

The sharpest test: **if it cannot be wrong in an interesting way, it is not an
agent.** It can be broken, but that is a bug, not bad judgement.

Components that judge need scoring against labelled data. Components that do not
judge need correctness tests — deterministic, pass/fail, no tolerance.

**Deciding which components fall on which side is part of the assignment.** We
have our own view; we are interested in yours, and in whether your evaluation
design reflects it.

---

## The components

### Memory — internally called Grain

One unit of memory is a *grain*: a single thing worth remembering about a
student.

**`Grain.write`**
Reads a finished tutoring conversation and decides what is worth remembering.
Most conversations produce very few grains. Many produce none at all.

*Input:* a conversation (alternating student/tutor turns), plus what is already
known about that student.
*Output:* zero or more grains.

**`Grain.recall`**
Fetches grains back by similarity to a query. Same query, same grains, no
opinion.

*Input:* a student, a query.
*Output:* an ordered list of grains.

**`Grain.survey`**
Answers a teacher's question about a whole classroom, drawing on the grains of
every student in it.

*Input:* a classroom, a teacher's question.
*Output:* a natural-language answer.

---

### Teaching

**`Seedbed`**
Reads a student's intake questionnaire plus any context supplied out of band, and
resolves both into the decisions everything downstream consumes.

*Input:* intake responses, supplementary context.
*Output:* a resolved student context.

**`Greenhouse`**
Turns a curriculum entry plus that student context into a complete lesson, in a
regular predictable shape.

*Input:* a curriculum entry, student context, an active teaching strategy.
*Output:* a structured lesson.

**`Blossom`**
The live tutoring conversation. The only component in this list that a student
sees by name.

*Input:* a student message, lesson context, retrieved grains.
*Output:* a tutor response.

---

### Teacher-facing

**`Almanac`**
Watches student activity and decides what is worth interrupting a teacher about —
breakthroughs, repeated confusion, disengagement, class-wide patterns.

*Input:* a student's recent activity within a classroom.
*Output:* zero or more alerts, each with a type and severity.

**`Groundskeeper`**
Handles support conversations: things that have gone wrong, as distinct from
things being taught.

*Input:* a support message and its context.
*Output:* a response, and a decision on whether to escalate.

---

### Machinery

These coordinate the components above. They are included so the inventory is
complete, and because how you choose to evaluate them — or decide not to — is
itself informative.

**`Meristem`**
Chooses which variant of a teaching strategy a given interaction gets, records
that choice, and later decides which variants survive.

**`Cultivar`**
Holds the population of strategy variants and the archive of everything
previously tried. Nothing is ever deleted; variants are retired.

**`Yield`**
Measures outcomes and links them back to the interaction that produced them.

---

## Things we have deliberately not told you

You will have to make assumptions. Making them **explicit** is part of what we are
assessing.

- Exact input and output schemas. The interface in `src/agents/registry.js` is
  the contract; the shapes in the stubs are illustrative.
- What "correct" means for any given component. That is the substance of the
  assignment.
- How many of these you should evaluate. Covering three well beats covering
  eleven shallowly — but tell us why you chose the three you did.

If an assumption you made turns out to be load-bearing, we would rather read
about it in your write-up than discover it in your code.
