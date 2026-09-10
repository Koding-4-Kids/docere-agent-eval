'use strict';

const fs = require('fs');
const path = require('path');
const { listAgents, getAgent } = require('./agents/registry');
const { getScorer } = require('./scoring');

/**
 * The evaluation runner.
 *
 * Loads gold-standard cases from data/gold/<agent-id>/, runs the agent over each
 * one, scores the result, and returns a report.
 *
 * A gold-standard file looks like:
 *
 *   {
 *     "id":       "conv-001",
 *     "scorer":   "exactMatch",
 *     "input":    { ... }        passed straight to agent.run()
 *     "expected": { ... }        what a human decided the answer should be
 *     "notes":    "why this case exists and why the expectation is what it is"
 *   }
 *
 * `notes` is not read by any code. It is there because a gold standard nobody can
 * justify is not a gold standard.
 */

const GOLD_ROOT = path.join(__dirname, '..', 'data', 'gold');

function describeError(err) {
  try {
    if (typeof err?.message === 'string' && err.message) return err.message;
    const description = String(err);
    if (description) return description;
  } catch {
    // Thrown objects can also fail during property access or string conversion.
  }
  return 'Agent threw without an error message';
}

function loadCases(agentId) {
  const dir = path.join(GOLD_ROOT, agentId);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => {
      const full = path.join(dir, f);
      try {
        const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
        return { ...parsed, _file: path.relative(process.cwd(), full) };
      } catch (err) {
        throw new Error(`Could not parse ${full}: ${err.message}`);
      }
    });
}

async function evaluateAgent(agentId) {
  const agent = getAgent(agentId);
  const cases = loadCases(agentId);

  const results = [];
  for (const testCase of cases) {
    let actual = null;

    try {
      actual = await agent.run(testCase.input);
    } catch (err) {
      // An agent that throws scores zero rather than halting the run — one bad
      // case should not hide the results of every other case.
      results.push({ id: testCase.id, score: 0, error: describeError(err), file: testCase._file });
      continue;
    }

    const scorer = getScorer(testCase.scorer || 'exactMatch');
    const { score, detail } = scorer.score({ actual, expected: testCase.expected, testCase });

    results.push({
      id: testCase.id,
      scorer: scorer.id,
      score,
      detail,
      actual,
      expected: testCase.expected,
      file: testCase._file,
    });
  }

  const scored = results.filter(r => typeof r.score === 'number');
  const mean = scored.length ? scored.reduce((a, r) => a + r.score, 0) / scored.length : null;

  return {
    agentId,
    agentName: agent.name,
    caseCount: results.length,
    meanScore: mean,
    results,
  };
}

async function evaluateAll() {
  const reports = [];
  for (const agent of listAgents()) {
    reports.push(await evaluateAgent(agent.id));
  }
  return reports;
}

module.exports = { evaluateAgent, evaluateAll, loadCases };
