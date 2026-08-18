# Evaluation Design: `Grain.survey` & Docere Agent Architecture

## 1. Agent Inventory & Classification

We classify each component in the Docere architecture into **Judgement Agents** (requiring scoring against labelled gold-standard datasets) and **Deterministic Machinery** (requiring unit/correctness testing).

### Judgement Agents (Evaluated on Gold Data)
* **`Grain.write`**: Evaluates finished tutoring dialogues to extract long-term memory grains (`misconceptions`, `unstuck` analogies, `traits`). *Why:* Deciding whether an utterance represents a persistent mental model vs. transient noise is a qualitative pedagogical judgement.
* **`Grain.survey`**: Synthesizes classroom-wide grains to answer targeted teacher queries, returning structured citations (`citedStudentIds`) and a free-text synthesis (`answer`). *Why:* Requires semantic information retrieval, distractor filtering, and conceptual synthesis.
* **`Almanac`**: Monitors student activity streams to emit teacher alerts (`inactive`, `breakthrough`, `too_many_questions`) with severity ratings. *Why:* Weighs the pedagogical necessity of interrupting a busy teacher against the risk of false-alarm fatigue.
* **`Blossom`**: Live student-facing tutor dialogue generator. *Why:* Balances pedagogical scaffolding, Socratic questioning, and tone.
* **`Seedbed`**: Resolves intake questionnaires and unstructured diagnostic notes into learner profiles. *Why:* Resolves conflicting or ambiguous qualitative student background data.
* **`Groundskeeper`**: Support and escalation handler. *Why:* Classifies technical frustration vs. curriculum confusion and decides when human escalation is required.

### Deterministic Systems (Evaluated via Property/Unit Tests)
* **`Grain.recall`**: Vector/kNN retrieval of stored grains given query embeddings. *Why:* A deterministic database query. Pass/fail unit tests verify index correctness and schema integrity.
* **`Greenhouse`**: Compiles structured lesson templates from student profiles and curriculum modules. *Why:* Template compilation and schema validation.
* **`Cultivar` & `Meristem`**: Strategy registry and multi-armed bandit variant routers. *Why:* State management and statistical allocation logic.
* **`Yield`**: Telemetry and outcome metrics linker. *Why:* Relational data pipeline and metric aggregation.

---

## 2. What I Chose to Evaluate, and What I Left Out

In this iteration, we focus deep evaluation on **`Grain.survey`**, establishing a complete, non-trivial, and gaming-resistant evaluation suite.

* **Why `Grain.survey`**: It sits at the intersection of structured retrieval (`citedStudentIds`) and unstructured natural language (`answer`). Evaluating it forces resolution of semantic similarity, polarity/state discrimination, scaling noise, distractor filtering, and cost asymmetries.
* **What was left out for v1**: Full live-transcript trajectory tracing (intermediate tool-call logging) was left for future agent-harness work; v1 intentionally focuses on high-fidelity outcome, citation, and pedagogical assertion grading.

---

## 3. The Gold Standard

The `grain.survey` gold standard contains **11 curated cases** across 5 operational profiles:

1. **Baseline & Multi-Item** (`example-001.json`, `partial-overlap-multi-011.json`): Targeted concepts with multiple valid student matches and irrelevant background grains.
2. **Contrastive Polarity Minimal-Pairs** (`polarity-loop-active-002.json`, `polarity-loop-mastery-003.json`): Tests whether the agent confuses lexical overlap with actual misconception. Case 002 contains an active infinite loop blocker (must cite); Case 003 contains loop definition mastery sharing ~90% word overlap (must NOT cite).
3. **True Negatives / Query Mismatches** (`zero-match-negative-004.json`): Questions on topics where no student has recorded difficulties. Requires zero citations and explicit negative-state text.
4. **Distractor Boundaries** (`distractor-syntax-vs-logic-005.json`, `distractor-stale-resolved-006.json`): Adjacent syntax errors vs. true naming logic; stale/resolved historical misconceptions vs. active blockers.
5. **Multi-Tier Scaling Curve** (`scale-small-5-007.json`, `scale-medium-15-008.json`, `scale-large-30-009.json`, `empty-classroom-010.json`): Evaluates signal-to-noise degradation as class size increases from 0 to 30 students.

---

## 4. Scoring Methodology

### A. Mathematical Formulation
To evaluate both citation accuracy and text validity without brittle string matching:

$$Precision = \frac{TP}{TP + FP}, \quad Recall = \frac{TP}{TP + FN}$$
$$F_{\beta} = (1 + \beta^2) \cdot \frac{Precision \cdot Recall}{(\beta^2 \cdot Precision) + Recall} \quad (\beta = 0.5)$$

### B. What a Mistake Costs: The Asymmetry of Pedagogical Misdiagnosis
* **False Positive (Misdiagnosis)**: **Severe Cost**. Falsely identifying an innocent student as struggling wastes teacher intervention time, harms student morale, and erodes teacher trust in the AI system.
* **False Negative (Omission)**: **Moderate Cost**. A student's ongoing issue will resurface in future lessons.
* **Formulation**: We set $\beta = 0.5$, weighting Precision **$2\times$ higher than Recall**.

### C. Empty Set Handling with Explicit Abstention Verification
To prevent degenerate agents from exploiting the $0/0 \to 1.0$ math by always outputting `[]`:
* When `|Expected| = 0` and `|Actual| = 0`, credit ($Score = 1.0$) is granted **only if** the answer text contains an explicit negative-state phrase (e.g. `"no students"`, `"none recorded"`, `"empty classroom"`).
* If the agent is silent (`""`) or hallucinates, it receives $0.0$.

### D. Concept & Assertion Matching
* `mustMention`: Grouped concept arrays with synonym banks (e.g., `[["s-201", "201"], ["while", "loop"]]`).
* `mustNotMention`: Forbidden distractor IDs/concepts.
* Text Score:
  $$Score_{text} = \max\left(0, \text{Coverage}(mustMention) - 1.5 \cdot \frac{\text{Leaks}(mustNotMention)}{|mustNotMention|}\right)$$
* Composite Score:
  $$Score = 0.65 \cdot F_{0.5} + 0.35 \cdot Score_{text}$$

---

## 5. Results & Diagnostic Insights Against the Stubs

Running the evaluation suite against the offline `Grain.survey` stub yields a macro-mean score of **0.330**:

| Case ID | Score | Scorer Diagnostic / Failure Mode Exposed |
| :--- | :--- | :--- |
| `empty-classroom-010` | **1.000 (ok)** | Correctly returned empty citation list and empty state message. |
| `zero-match-negative-004` | **0.000 (FAIL)** | Hallucinated citations by dumping all students when 0 were expected. |
| `polarity-loop-mastery-003` | **0.000 (FAIL)** | Cites mastered students due to lexical overlap on `"while loop"`. |
| `scale-small-5-007` | **0.295 (~)** | Cites all 5 students (2 targets, 3 false positives). |
| `scale-medium-15-008` | **0.222 (~)** | Precision degrades as 13 noise students are leaked. |
| `scale-large-30-009` | **0.167 (~)** | Extreme precision collapse on 30 students (3 targets, 27 false positives). |
| `example-001` | **0.464 (~)** | Captured targets s-201 and s-203, but leaked distractor s-202. |

**Key Finding**: The suite clearly visualizes the stub's failure curve: as classroom size expands, the stub's indiscriminate dumping causes scores to monotonically decay from 0.295 down to 0.167.

---

## 6. Limitations, Assumptions & Metric Gaming

### Anti-Gaming Protection & Degenerate Agent Baselines
Our automated test suite (`tests/antiGaming.test.js`) verifies that trivial shortcut policies cannot game this suite:
* **`SilentAgent`** (always returns `[]` and `""`): Mean score = **0.000** ($< 0.30$ baseline threshold).
* **`GreedyAgent`** (cites every student and dumps names): Mean score = **0.166** ($< 0.25$ baseline threshold).
* **`EchoAgent`** (dumps all raw grains verbatim): Mean score = **0.244** ($< 0.35$ baseline threshold).

### Potential Remaining Gaming Vector
If an agent were tuned directly against this scorer, it could learn to format its output as a comma-separated list of student IDs matching only high-confidence keywords and append a generic sentence containing common computer science terms.

### Limitations
1. **Regex/Synonym Matching**: Synonym banks cannot catch deeply novel paraphrasing or complex grammatical double negatives.
2. **Dataset Size**: 11 cases provides strong v1 smoke-testing, but larger held-out randomized sets are needed for benchmark robustness.
3. **Provisional Weights**: Weights ($w_{cite}=0.65, w_{text}=0.35, \beta=0.5$) are grounded in domain reasoning but await empirical multi-rater teacher calibration.

---

## 7. What I Would Do Next (With Another Week)

1. **Trajectory & Tool-Call Tracing**: Instrument the agent harness to evaluate whether `Grain.survey` issues minimal, efficient database queries or leaks private student metadata in intermediate reasoning hops.
2. **LLM-as-a-Judge Calibration**: Integrate a dual-layer scorer where deterministic regex handles fast CI gates, and an LLM judge (calibrated against 50+ teacher-annotated transcripts) grades pedagogical nuance.
3. **Dynamic Synthetic Scenario Generator**: Build a parameterized generator to synthesize infinite randomized classroom configurations (varying student counts, distractor densities, and topic domains) to eliminate dataset memorization.
