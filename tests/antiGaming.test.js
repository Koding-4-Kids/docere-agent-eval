'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { loadCases } = require('../src/runner');
const { getScorer } = require('../src/scoring');

const cases = loadCases('grain.survey');
const scorer = getScorer('grainSurveyScorer');

// 1. SilentAgent: refuses to cite or say anything (attempts to game 0/0 and precision)
const silentAgent = {
  run: async () => ({
    citedStudentIds: [],
    answer: '',
  }),
};

// 2. GreedyAgent: cites every student in the classroom and repeats all student IDs in answer
const greedyAgent = {
  run: async (input) => {
    const students = (input && input.students) || [];
    const ids = students.map(s => s.id);
    return {
      citedStudentIds: ids,
      answer: `Students ${ids.join(', ')} are in the classroom.`,
    };
  },
};

// 3. EchoAgent: dumps all raw grain strings and cites all students (similar to uncurated stubs)
const echoAgent = {
  run: async (input) => {
    const students = (input && input.students) || [];
    const all = students.flatMap(s => (s.grains || []).map(g => ({ id: s.id, text: g.text })));
    return {
      citedStudentIds: [...new Set(all.map(g => g.id))],
      answer: all.map(g => `${g.id}: ${g.text}`).join('; '),
    };
  },
};

async function evaluateSyntheticAgent(agent) {
  const scores = [];
  for (const c of cases) {
    const actual = await agent.run(c.input);
    const result = scorer.score({ actual, expected: c.expected, testCase: c });
    scores.push(result.score);
  }
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

test('antiGaming: SilentAgent (always abstains without negative phrasing) cannot game the suite', async () => {
  const mean = await evaluateSyntheticAgent(silentAgent);
  // SilentAgent gets 0.0 on zero-expected cases because it has no negative-state phrasing,
  // and gets 0.0 on positive cases because it cites nothing.
  assert.ok(mean < 0.30, `SilentAgent mean score was ${mean.toFixed(3)}, expected < 0.30`);
});

test('antiGaming: GreedyAgent (cites every student) cannot game the suite', async () => {
  const mean = await evaluateSyntheticAgent(greedyAgent);
  // GreedyAgent suffers heavy FP penalties under F-0.5 and distractor leak penalties
  assert.ok(mean < 0.25, `GreedyAgent mean score was ${mean.toFixed(3)}, expected < 0.25`);
});

test('antiGaming: EchoAgent (dumps all grains indiscriminately) cannot game the suite', async () => {
  const mean = await evaluateSyntheticAgent(echoAgent);
  assert.ok(mean < 0.35, `EchoAgent mean score was ${mean.toFixed(3)}, expected < 0.35`);
});
