'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { getScorer, listScorers } = require('../src/scoring');
const { listAgents, getAgent } = require('../src/agents/registry');
const { loadCases, evaluateAgent } = require('../src/runner');

/**
 * A starting point, not a suite. These cover the plumbing so you can tell a
 * broken harness from a low score.
 *
 * Worth adding as you go: tests for your own scorers, especially the edge cases
 * where the maths is undefined rather than zero. An empty expectation against an
 * empty output is the one that bites first.
 */

test('every registered agent has the required shape', () => {
  for (const agent of listAgents()) {
    assert.ok(agent.id, 'agent needs an id');
    assert.ok(agent.name, `${agent.id} needs a name`);
    assert.strictEqual(typeof agent.run, 'function', `${agent.id}.run must be a function`);
  }
});

test('getAgent throws helpfully for an unknown id', () => {
  assert.throws(() => getAgent('nope'), /No agent registered/);
});

test('exactMatch scores identical output as 1', () => {
  const { score } = getScorer('exactMatch').score({
    actual: { grains: [{ text: 'a', type: 'misconception' }] },
    expected: { grains: [{ text: 'a', type: 'misconception' }] },
  });
  assert.strictEqual(score, 1);
});

test('exactMatch scores anything else as 0, including near misses', () => {
  const { score } = getScorer('exactMatch').score({
    actual: { grains: [{ text: 'Mixes up = and ==', type: 'misconception' }] },
    expected: { grains: [{ text: 'Confuses = and ==', type: 'misconception' }] },
  });
  // Same grain to a human. This is the limitation to design around.
  assert.strictEqual(score, 0);
});

test('exactMatch is order sensitive, which is usually wrong for a set', () => {
  const a = { grains: [{ text: 'x' }, { text: 'y' }] };
  const b = { grains: [{ text: 'y' }, { text: 'x' }] };
  assert.strictEqual(getScorer('exactMatch').score({ actual: a, expected: b }).score, 0);
});

test('every scorer returns a number between 0 and 1', () => {
  for (const scorer of listScorers()) {
    const { score } = scorer.score({ actual: { a: 1 }, expected: { a: 2 } });
    assert.ok(score >= 0 && score <= 1, `${scorer.id} returned ${score}`);
  }
});

test('gold-standard cases parse and carry the required fields', () => {
  for (const agent of listAgents()) {
    for (const c of loadCases(agent.id)) {
      assert.ok(c.id, `${c._file} needs an id`);
      assert.ok('input' in c, `${c._file} needs an input`);
      assert.ok('expected' in c, `${c._file} needs an expected`);
      assert.ok(c.notes && c.notes.length > 0, `${c._file} needs notes explaining why it exists`);
    }
  }
});

test('the runner completes for every agent without throwing', async () => {
  for (const agent of listAgents()) {
    const report = await evaluateAgent(agent.id);
    assert.strictEqual(report.agentId, agent.id);
    assert.ok(Array.isArray(report.results));
  }
});
