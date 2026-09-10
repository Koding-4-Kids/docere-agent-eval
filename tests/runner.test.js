'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getAgent } = require('../src/agents/registry');
const { getScorer } = require('../src/scoring');
const { evaluateAgent, loadCases } = require('../src/runner');

const failures = [
  ['Error', new Error('agent failed'), 'agent failed'],
  ['empty Error', new Error(''), 'Error'],
  ['string', 'agent failed', 'agent failed'],
  ['empty string', '', 'Agent threw without an error message'],
  ['null', null, 'null'],
  ['undefined', undefined, 'undefined'],
  ['zero', 0, '0'],
  ['false', false, 'false'],
  ['object without a prototype', Object.create(null), 'Agent threw without an error message'],
];

for (const mode of ['throw', 'reject']) {
  for (const [label, failure, expectedError] of failures) {
    test(`runner isolates ${mode}: ${label}, skips scoring, and continues`, async () => {
      const agent = getAgent('grain.write');
      const scorer = getScorer('exactMatch');
      const originalRun = agent.run;
      const originalScore = scorer.score;
      const cases = loadCases(agent.id);
      assert.ok(cases.length > 1, 'requires a later case to verify continuation');
      let calls = 0;
      let scoringCalls = 0;

      agent.run = () => {
        const index = calls++;
        if (index === 0) {
          if (mode === 'reject') return Promise.reject(failure);
          throw failure;
        }
        return cases[index].expected;
      };
      scorer.score = args => {
        scoringCalls++;
        return originalScore(args);
      };

      try {
        const report = await evaluateAgent(agent.id);
        assert.equal(report.caseCount, cases.length);
        assert.equal(calls, cases.length);
        assert.equal(scoringCalls, cases.length - 1);
        assert.deepEqual(report.results[0], {
          id: cases[0].id,
          score: 0,
          error: expectedError,
          file: cases[0]._file,
        });
        assert.ok(report.results.slice(1).every(result => result.score === 1));
        assert.equal(report.meanScore, (cases.length - 1) / cases.length);
      } finally {
        agent.run = originalRun;
        scorer.score = originalScore;
      }
    });
  }
}
