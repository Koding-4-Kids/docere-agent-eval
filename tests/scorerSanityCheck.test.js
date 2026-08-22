'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { getScorer } = require('../src/scoring');

const scorer = getScorer('grainSurveyScorer');

const standardCase = {
  citedStudentIds: ['s-201', 's-203'],
  mustMention: [
    ['s-201', '201'],
    ['s-203', '203'],
    ['loop', 'while', 'off-by-one', 'range', 'termination']
  ],
  mustNotMention: ['s-202', 'conditionals'],
};

test('scorerSanityCheck: 10 representative human pedagogical verdicts validate monotonic ranking', () => {
  // 1. Ideal response: accurate citations and synthesis
  const r1_ideal = scorer.score({
    actual: {
      citedStudentIds: ['s-201', 's-203'],
      answer: 'Students s-201 and s-203 are struggling with loop termination and off-by-one bounds in ranges.',
    },
    expected: standardCase,
  });

  // 2. Good paraphrase: accurate citations, synonyms used instead of literal terms
  const r2_paraphrase = scorer.score({
    actual: {
      citedStudentIds: ['s-201', 's-203'],
      answer: 'Student 201 has trouble with while execution, and 203 gets confused by boundary offsets.',
    },
    expected: standardCase,
  });

  // 3. Under-citing: found s-201 but missed s-203 (omission)
  const r3_undercite = scorer.score({
    actual: {
      citedStudentIds: ['s-201'],
      answer: 'Student s-201 is struggling with while loop termination.',
    },
    expected: standardCase,
  });

  // 4. Over-citing: cited s-201, s-203, plus innocent student s-205 (misdiagnosis)
  const r4_overcite = scorer.score({
    actual: {
      citedStudentIds: ['s-201', 's-203', 's-205'],
      answer: 'Students s-201, s-203, and s-205 all have loop difficulties.',
    },
    expected: standardCase,
  });

  // 5. Distractor Leak: cited s-201 and s-203, but included forbidden s-202 conditionals in text
  const r5_distractorLeak = scorer.score({
    actual: {
      citedStudentIds: ['s-201', 's-203'],
      answer: 's-201 and s-203 have loop issues, while s-202 struggles with conditionals.',
    },
    expected: standardCase,
  });

  // 6. Hallucination / Total Mismatch: cited fake student and irrelevant text
  const r6_hallucination = scorer.score({
    actual: {
      citedStudentIds: ['s-999'],
      answer: 'Student s-999 had an issue with database schema.',
    },
    expected: standardCase,
  });

  // 7. Empty Abstain Good: zero expected, correctly stated no students
  const r7_emptyGood = scorer.score({
    actual: {
      citedStudentIds: [],
      answer: 'No students were found with this issue in the classroom.',
    },
    expected: { citedStudentIds: [], mustMention: [['no students', 'none']] },
  });

  // 8. Empty Abstain Silent: zero expected, returned blank string
  const r8_emptySilent = scorer.score({
    actual: {
      citedStudentIds: [],
      answer: '',
    },
    expected: { citedStudentIds: [], mustMention: [['no students', 'none']] },
  });

  // 9. Scaling Good: 2 targets correctly cited out of 15 students
  const r9_scalingGood = scorer.score({
    actual: {
      citedStudentIds: ['s-803', 's-811'],
      answer: 'Students s-803 and s-811 have string type conversion errors.',
    },
    expected: {
      citedStudentIds: ['s-803', 's-811'],
      mustMention: [['s-803'], ['s-811'], ['string', 'conversion']],
      mustNotMention: ['s-801', 's-802', 's-804'],
    },
  });

  // 10. Scaling Bad / Dump: cited all 15 students in the classroom
  const r10_scalingDump = scorer.score({
    actual: {
      citedStudentIds: ['s-801', 's-802', 's-803', 's-804', 's-805', 's-806', 's-807', 's-808', 's-809', 's-810', 's-811', 's-812', 's-813', 's-814', 's-815'],
      answer: 's-801, s-802, s-803, s-804, s-805, s-806, s-807, s-808, s-809, s-810, s-811, s-812, s-813, s-814, s-815 have records.',
    },
    expected: {
      citedStudentIds: ['s-803', 's-811'],
      mustMention: [['s-803'], ['s-811'], ['string', 'conversion']],
      mustNotMention: ['s-801', 's-802', 's-804'],
    },
  });

  // Assertion 1: Citation Asymmetry Check (F-0.5 rewards precision: pure omission > pure misdiagnosis)
  assert.ok(
    r3_undercite.detail.citationScore > r4_overcite.detail.citationScore,
    `Undercite citation score (${r3_undercite.detail.citationScore}) must exceed Overcite (${r4_overcite.detail.citationScore}) under F-0.5`
  );

  // Assertion 2: Monotonic quality ordering
  assert.ok(r1_ideal.score >= r2_paraphrase.score, `Ideal (${r1_ideal.score}) should be >= Paraphrase (${r2_paraphrase.score})`);
  assert.ok(r2_paraphrase.score > r3_undercite.score, `Paraphrase (${r2_paraphrase.score}) should be > Undercite (${r3_undercite.score})`);
  assert.ok(r3_undercite.score > r5_distractorLeak.score, `Undercite (${r3_undercite.score}) should be > Distractor Leak (${r5_distractorLeak.score})`);
  assert.ok(r5_distractorLeak.score > r6_hallucination.score, `Distractor Leak (${r5_distractorLeak.score}) should be > Hallucination (${r6_hallucination.score})`);

  // Assertion 3: Paraphrase robustness (maintains >= 85% of ideal score)
  assert.ok(r2_paraphrase.score >= 0.85 * r1_ideal.score, `Paraphrase score ${r2_paraphrase.score} should be >= 0.85 * ${r1_ideal.score}`);

  // Assertion 4: Distractor sensitivity (leaking forbidden distractor receives explicit penalty)
  assert.strictEqual(r5_distractorLeak.detail.distractorLeaks, 2);
  assert.strictEqual(r5_distractorLeak.detail.textScore, 0.0);

  // Assertion 5: Empty state contrast (good negative phrasing vs silent failure)
  assert.strictEqual(r7_emptyGood.score, 1.0);
  assert.strictEqual(r8_emptySilent.score, 0.0);

  // Assertion 6: Scaling contrast
  assert.strictEqual(r9_scalingGood.score, 1.0);
  assert.ok(r10_scalingDump.score < 0.20, `Scaling dump score (${r10_scalingDump.score}) should be < 0.20`);
});
