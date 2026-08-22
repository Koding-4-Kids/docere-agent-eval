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
5. **Multi-Tier Scaling Curve** (`scale-small-5-007.json`, `scale-medium-15-008.json`, `scale-large-30-009.json`, `empty-classroom-010.json`): Evaluates signal-to-noise degradation and verbosity bloat as class size increases from 0 to 30 students.

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

### C. Citation-Gated Coupling & Text Scoring Rationale
A common trap in composite metrics is treating text generation and citation retrieval as independent additive goals:
$$\text{Naive Additive: } Score = 0.65 \cdot S_{\text{cite}} + 0.35 \cdot S_{\text{text}}$$

**Why that is fundamentally flawed for an evidence-based RAG agent**:
In `Grain.survey`, the natural language text is an explanation **conditioned on retrieved citations**. If the agent fails to cite the correct students ($S_{\text{cite}} = 0$), any text explanation it generates is ungrounded / hallucinated. An agent that cites nobody should not be able to bank a "free" 0.35 score merely by keyword stuffing general statements about computer science.

**The Solution: Citation-Gated Conjunction**:
$$Score = S_{\text{cite}} \cdot \left((1 - w_{\text{text}}) + w_{\text{text}} \cdot S_{\text{text}}\right) \cdot M_{\text{length}}$$
* If citation fails completely ($S_{\text{cite}} = 0$), the total score is strictly **0.0**.
* If citations are accurate ($S_{\text{cite}} = 1.0$), $S_{\text{text}}$ scales the remaining $35\%$ synthesis credit.
* If a forbidden distractor is leaked, $S_{\text{text}} \to 0$, penalizing the agent down to the base citation credit ($0.65$).

### D. Universal Distractor Checking & Abstention Verification
* **Universal Distractor Execution**: `mustNotMention` checks run on **all** cases, including zero-expected cases. If an agent outputs *"No students found. Also s-999 is struggling"*, leaking `s-999` immediately invalidates the negative-state abstention, dropping the score to **0.0**.
* **Tight Abstention Phrasing**: Phrase matching enforces explicit pedagogical negative statements (e.g. `"no students"`, `"none recorded"`, `"empty classroom"`), rejecting generic single words like `"nothing"` to prevent false positive passes.

### E. Verbosity / Length Efficiency Penalty ($M_{\text{length}}$)
In classroom operations, a teacher reviewing survey results in a 5-minute planning window needs a concise synthesis, not a raw dump of 30 student profiles.
* **Length Budget**: Target budget $B = \max(120, |Expected| \cdot 40 + 80)$ tokens.
* **Penalty Multiplier**:
  $$M_{\text{length}} = \begin{cases} 1.0 & \text{if } \text{Tokens} \le B \\ \max\left(0.40, \frac{1.0}{1.0 + 0.6 \cdot \frac{\text{Tokens} - B}{B}}\right) & \text{if } \text{Tokens} > B \end{cases}$$

---

## 5. Results & Diagnostic Insights Against the Stubs

Running the evaluation suite against the offline `Grain.survey` stub yields a macro-mean score of **0.314**:

| Case ID | Score | Scorer Diagnostic / Failure Mode Exposed |
| :--- | :--- | :--- |
| `empty-classroom-010` | **1.000 (ok)** | Correctly returned empty citation list and empty state message. |
| `zero-match-negative-004` | **0.000 (FAIL)** | Hallucinated citations by dumping all students when 0 were expected. |
| `polarity-loop-mastery-003` | **0.000 (FAIL)** | Cites mastered students due to lexical overlap on `"while loop"`. |
| `scale-small-5-007` | **0.295 (~)** | Cites all 5 students (2 targets, 3 false positives). |
| `scale-medium-15-008` | **0.124 (~)** | Precision collapse + length penalty (220 tokens dumped). |
| `scale-large-30-009` | **0.080 (~)** | Extreme precision collapse + heavy verbosity penalty (500+ tokens dumped). |
| `example-001` | **0.464 (~)** | Captured targets s-201 and s-203, but leaked distractor s-202. |

**Key Finding**: The combination of $F_{0.5}$ precision weighting and length efficiency clearly isolates the stub's failure curve: as classroom size expands, the score monotonically drops from **0.295** (5 students) $\to$ **0.124** (15 students) $\to$ **0.080** (30 students).

---

## 6. Limitations, Assumptions & Metric Gaming

### Anti-Gaming Protection & Degenerate Agent Baselines
Our automated test suite (`tests/antiGaming.test.js`) verifies that trivial shortcut policies cannot game this suite:
* **`SilentAgent`** (always returns `[]` and `""`): Mean score = **0.000** ($< 0.30$ baseline threshold).
* **`GreedyAgent`** (cites every student and dumps names): Mean score = **0.145** ($< 0.25$ baseline threshold).
* **`EchoAgent`** (dumps all raw grains verbatim): Mean score = **0.187** ($< 0.35$ baseline threshold).

### What an Agent Might Try to Game (and How We Catch It)
1. **Keyword Stuffing with Zero Citations**: An agent that outputs generic textbook explanations while citing `[]` gets strictly **0.0** because text credit is gated on $S_{\text{cite}}$.
2. **Indiscriminate Dumping**: An agent that cites everyone and dumps their grains gets penalized on two fronts: precision collapse under $F_{0.5}$ and length penalties under $M_{\text{length}}$.
3. **Empty-Set Farming**: An agent that outputs `[]` for every query gets **0.0** on zero-expected cases unless it explicitly generates a negative-state pedagogical phrase, and gets **0.0** across all non-empty cases.

### Remaining Gaming Vector
If an agent were tuned directly against this scorer, it could memorize the canonical student ID formats (`s-XXX`), cite only the single highest-confidence student to maximize precision, and append a concise generic sentence matching common synonym stems while strictly staying below the 120-token length budget.

---

## 7. What I Would Do Next (With Another Week)

1. **Trajectory & Tool-Call Tracing**: Instrument the agent harness to evaluate intermediate retrieval hops (e.g. database query efficiency and privacy boundary enforcement in tool arguments).
2. **Dual-Layer LLM-as-a-Judge Calibration**: Integrate a fast offline regex scorer for local CI and a calibrated LLM-judge for deeper semantic evaluation on staging.
3. **Dynamic Synthetic Scenario Generator**: Parameterize classroom generators to produce randomized student counts and distractor densities, eliminating fixed-case memorization.
