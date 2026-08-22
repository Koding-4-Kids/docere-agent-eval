'use strict';

/**
 * Scoring registry.
 *
 * A scorer compares one agent output against one gold-standard expectation and
 * returns a score between 0 and 1, plus whatever detail is useful for reading
 * the result.
 *
 *   {
 *     id:      string
 *     score:   ({ actual, expected, testCase }) => {
 *                score: number,        // 0..1
 *                detail?: object       // anything that helps explain the number
 *              }
 *   }
 *
 * `exactMatch` is the baseline. It is intentionally crude — it will tell you
 * almost nothing useful about the stubs, which is the point. Replacing it with
 * something defensible is the core of the assignment.
 *
 * Add your own scorers here. Gold-standard files select a scorer by id, so an
 * agent whose output is a set can be scored differently from one whose output is
 * free text.
 */

const exactMatch = require('./exactMatch');
const grainSurveyScorer = require('./grainSurveyScorer');

const SCORERS = [exactMatch, grainSurveyScorer];

function getScorer(id) {
  const scorer = SCORERS.find(s => s.id === id);
  if (!scorer) {
    throw new Error(
      `No scorer registered with id "${id}". Registered: ${SCORERS.map(s => s.id).join(', ')}`
    );
  }
  return scorer;
}

function listScorers() {
  return SCORERS.slice();
}

module.exports = { getScorer, listScorers };
