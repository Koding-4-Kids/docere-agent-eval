'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { getScorer } = require('../src/scoring');

const scorer = getScorer('grainSurveyScorer');

test('grainSurveyScorer calculates F-0.5 correctly with precision weighted 2x over recall', () => {
  // TP=2, FP=0, FN=1 -> Precision=1.0, Recall=0.6667
  // F0.5 = (1 + 0.25)*(1.0 * 0.6667) / (0.25 * 1.0 + 0.6667) = 1.25 * 0.6667 / 0.9167 = 0.9091
  const result = scorer.score({
    actual: {
      citedStudentIds: ['s-1', 's-2'],
      answer: 's-1 and s-2 struggle with loop bounds.',
    },
    expected: {
      citedStudentIds: ['s-1', 's-2', 's-3'],
      mustMention: [['loop', 'bounds']],
      citationWeight: 1.0,
      textWeight: 0.0,
    },
  });

  assert.strictEqual(result.detail.truePositives, 2);
  assert.strictEqual(result.detail.falsePositives, 0);
  assert.strictEqual(result.detail.falseNegatives, 1);
  assert.strictEqual(result.detail.precision, 1.0);
  assert.ok(Math.abs(result.detail.f05 - 0.9091) < 0.01, `Expected ~0.9091, got ${result.detail.f05}`);
});

test('grainSurveyScorer penalizes False Positives (over-citing) harder than False Negatives', () => {
  // Case A: 1 FN (TP=1, FP=0, FN=1) -> Precision=1.0, Recall=0.5 -> F0.5 = 1.25 * 0.5 / (0.25 + 0.5) = 0.8333
  const scoreFN = scorer.score({
    actual: { citedStudentIds: ['s-1'], answer: 'Found s-1' },
    expected: { citedStudentIds: ['s-1', 's-2'], citationWeight: 1.0, textWeight: 0.0 },
  }).score;

  // Case B: 1 FP (TP=1, FP=1, FN=0) -> Precision=0.5, Recall=1.0 -> F0.5 = 1.25 * 0.5 / (0.25*0.5 + 1.0) = 0.625 / 1.125 = 0.5556
  const scoreFP = scorer.score({
    actual: { citedStudentIds: ['s-1', 's-3'], answer: 'Found s-1 and s-3' },
    expected: { citedStudentIds: ['s-1'], citationWeight: 1.0, textWeight: 0.0 },
  }).score;

  assert.ok(scoreFN > scoreFP, `Expected score with FN (${scoreFN}) to be higher than score with FP (${scoreFP}) under F-0.5`);
});

test('grainSurveyScorer strictly gates text score on citation success (zero citations = zero score)', () => {
  // Agent writes correct keywords but failed to cite the required student
  const result = scorer.score({
    actual: {
      citedStudentIds: [],
      answer: 'Some students struggle with while loops and infinite loops and condition bounds.',
    },
    expected: {
      citedStudentIds: ['s-201'],
      mustMention: [['while', 'loop']],
    },
  });

  assert.strictEqual(result.detail.citationScore, 0.0);
  assert.strictEqual(result.score, 0.0, 'An agent that cites nobody on non-empty expected cases must receive 0.0');
});

test('grainSurveyScorer verifies negative-state phrasing on empty expectation', () => {
  // Good: Empty citations + explicit negative phrase -> 1.0
  const goodAbstain = scorer.score({
    actual: { citedStudentIds: [], answer: 'No students were found with this misconception.' },
    expected: { citedStudentIds: [], mustMention: [['no students', 'none']] },
  });
  assert.strictEqual(goodAbstain.score, 1.0);
  assert.strictEqual(goodAbstain.detail.abstentionVerified, true);

  // Bad: Empty citations + empty answer (or generic non-negative) -> 0.0
  const silentEmpty = scorer.score({
    actual: { citedStudentIds: [], answer: '' },
    expected: { citedStudentIds: [], mustMention: [['no students', 'none']] },
  });
  assert.strictEqual(silentEmpty.score, 0.0);
  assert.strictEqual(silentEmpty.detail.abstentionVerified, false);

  // Bad: Hallucinated citations when 0 expected -> 0.0
  const hallucinated = scorer.score({
    actual: { citedStudentIds: ['s-99'], answer: 'Found s-99 struggling.' },
    expected: { citedStudentIds: [] },
  });
  assert.strictEqual(hallucinated.score, 0.0);
  assert.strictEqual(hallucinated.detail.falsePositives, 1);
});

test('grainSurveyScorer executes mustNotMention distractor checks on zero-expected cases', () => {
  const result = scorer.score({
    actual: {
      citedStudentIds: [],
      answer: 'No students found. Also s-999 is terrible at everything.',
    },
    expected: {
      citedStudentIds: [],
      mustMention: [['no students', 'none']],
      mustNotMention: ['s-999'],
    },
  });

  assert.strictEqual(result.detail.distractorLeaks, 1);
  assert.strictEqual(result.detail.textScore, 0.0);
  assert.strictEqual(result.score, 0.0, 'Leaking a forbidden distractor on zero-expected case must drop score to 0');
});

test('grainSurveyScorer penalizes excessive verbosity and raw text dumping', () => {
  const conciseAnswer = 'Students s-101 and s-102 struggle with loops.';
  const verboseDump = 'Students s-101 and s-102 struggle with loops. ' + 'extra noise word '.repeat(200);

  const conciseResult = scorer.score({
    actual: { citedStudentIds: ['s-101', 's-102'], answer: conciseAnswer },
    expected: { citedStudentIds: ['s-101', 's-102'], mustMention: [['loop']] },
  });

  const verboseResult = scorer.score({
    actual: { citedStudentIds: ['s-101', 's-102'], answer: verboseDump },
    expected: { citedStudentIds: ['s-101', 's-102'], mustMention: [['loop']] },
  });

  assert.strictEqual(conciseResult.score, 1.0);
  assert.ok(verboseResult.detail.lengthMultiplier < 0.80, `Length multiplier (${verboseResult.detail.lengthMultiplier}) should penalize excessive length`);
  assert.ok(verboseResult.score < conciseResult.score, 'Excessive verbosity dump should score lower than concise answer');
});

test('grainSurveyScorer handles concept synonym groups and distractor leak penalties', () => {
  const result = scorer.score({
    actual: {
      citedStudentIds: ['s-101'],
      answer: 'Student s-101 struggles with identifier naming rules and also s-102 has syntax errors.',
    },
    expected: {
      citedStudentIds: ['s-101'],
      mustMention: [
        ['s-101', '101'],
        ['identifier', 'variable name', 'naming']
      ],
      mustNotMention: ['s-102', 'syntax'],
      citationWeight: 0.5,
      textWeight: 0.5,
    },
  });

  assert.strictEqual(result.detail.conceptCoverage, 1.0); // both concept groups matched
  assert.strictEqual(result.detail.distractorLeaks, 2); // s-102 and syntax leaked
  assert.strictEqual(result.detail.textScore, 0.0); // 1.0 - 1.5*(2/2) = 0.0
  assert.strictEqual(result.score, 0.5); // 1.0 * (0.5 + 0.5*0.0)
});

test('grainSurveyScorer is resilient against malformed and unexpected inputs', () => {
  assert.doesNotThrow(() => scorer.score({ actual: null, expected: null }));
  assert.doesNotThrow(() => scorer.score({ actual: {}, expected: {} }));
  assert.doesNotThrow(() => scorer.score({ actual: { citedStudentIds: 'invalid' }, expected: { citedStudentIds: 123 } }));

  const malformed = scorer.score({ actual: 'not an object', expected: { citedStudentIds: ['s-1'] } });
  assert.ok(malformed.score >= 0 && malformed.score <= 1);
  assert.strictEqual(malformed.detail.precision, 0);
  assert.strictEqual(malformed.detail.recall, 0);
});
