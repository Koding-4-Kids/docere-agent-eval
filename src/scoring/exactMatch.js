'use strict';

/**
 * exactMatch — the baseline scorer.
 *
 * Serialises actual and expected output and compares them as strings. Returns 1
 * for identical, 0 for anything else.
 *
 * This is deliberately the dumbest thing that runs end to end. It is here so the
 * runner works out of the box and so you have something to improve on, not
 * because it is a reasonable way to evaluate any of these agents.
 *
 * Some of the reasons it is inadequate, to save you writing them down:
 *
 *   - No partial credit. An answer that found four of five correct items scores
 *     the same as one that found nothing.
 *   - Order-sensitive. Two identical sets of grains in a different order score 0.
 *   - Literal. "Confuses = and ==" and "Mixes up = and ==" are the same grain to
 *     a human and different strings to this.
 *   - One number for every agent, regardless of whether the output is a set, a
 *     ranked list, or free text.
 *
 * A better scorer is the substance of this assignment. Think about what a
 * mistake actually costs in each case — the answer is not the same for every
 * agent, and it may not be symmetric within one.
 */

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = stable(value[k]);
        return acc;
      }, {});
  }
  return value;
}

function score({ actual, expected }) {
  const a = JSON.stringify(stable(actual));
  const b = JSON.stringify(stable(expected));
  return {
    score: a === b ? 1 : 0,
    detail: { identical: a === b },
  };
}

module.exports = { id: 'exactMatch', score };
