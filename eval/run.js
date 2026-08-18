#!/usr/bin/env node
'use strict';

const { evaluateAgent, evaluateAll } = require('../src/runner');
const { listAgents } = require('../src/agents/registry');

/**
 * CLI for the evaluation suite.
 *
 *   node eval/run.js                    every registered agent
 *   node eval/run.js grain.write        one agent
 *   node eval/run.js --verbose          include per-case actual vs expected
 *   node eval/run.js --json             machine-readable output
 */

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const asJson = args.includes('--json');
const agentId = args.find(a => !a.startsWith('--'));

function fmt(n) {
  return n === null ? ' n/a ' : n.toFixed(3);
}

function printReport(report) {
  const { agentName, agentId: id, caseCount, meanScore, results } = report;

  console.log('');
  console.log(`${agentName}  (${id})`);

  if (caseCount === 0) {
    console.log(`  no gold-standard cases found in data/gold/${id}/`);
    return;
  }

  console.log(`  cases: ${caseCount}    mean score: ${fmt(meanScore)}`);
  console.log('');

  for (const r of results) {
    const mark = r.error ? 'ERR' : r.score === 1 ? ' ok' : r.score === 0 ? 'FAIL' : ' ~ ';
    console.log(`  ${mark}  ${String(r.id).padEnd(24)} ${fmt(r.score)}  ${r.scorer || ''}`);
    if (r.error) console.log(`        error: ${r.error}`);
    if (verbose && !r.error) {
      console.log(`        expected: ${JSON.stringify(r.expected)}`);
      console.log(`        actual:   ${JSON.stringify(r.actual)}`);
    }
  }
}

(async () => {
  try {
    const reports = agentId ? [await evaluateAgent(agentId)] : await evaluateAll();

    if (asJson) {
      console.log(JSON.stringify(reports, null, 2));
      return;
    }

    reports.forEach(printReport);

    const withCases = reports.filter(r => r.caseCount > 0);
    console.log('');
    if (withCases.length === 0) {
      console.log('No gold-standard cases found for any agent.');
      console.log(`Registered agents: ${listAgents().map(a => a.id).join(', ')}`);
      console.log('Add cases under data/gold/<agent-id>/ — see data/gold/README.md');
    } else {
      const overall =
        withCases.reduce((a, r) => a + r.meanScore, 0) / withCases.length;
      console.log(`Overall mean across ${withCases.length} agent(s): ${fmt(overall)}`);
      console.log('');
      console.log('A low score here is expected. The stubs are imperfect on purpose,');
      console.log('and exactMatch is a poor way to measure them. Both are yours to improve.');
    }
    console.log('');
  } catch (err) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }
})();
