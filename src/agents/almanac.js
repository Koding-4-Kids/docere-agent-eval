'use strict';

/**
 * Almanac (STUB)
 *
 * Watches a student's recent activity and decides what is worth interrupting a
 * teacher about. Emits zero or more alerts.
 *
 * This stub uses fixed thresholds with no memory of what it has already raised,
 * so it will re-alert on a persistent condition every time it runs. Whether that
 * matters — and how you would measure it — is a design question for you.
 *
 * Note that the cost of a mistake is asymmetric here in a way it is not for
 * Grain.write. A missed alert and a spurious alert are not equally bad, and they
 * are not equally bad across alert types either.
 */

/**
 * @param {{
 *   daysSinceActivity?: number,
 *   questionsAsked?: number,
 *   recentScores?: number[],
 *   priorScores?: number[]
 * }} input
 * @returns {Promise<{ alerts: Array<{type: string, severity: string}> }>}
 */
async function run(input) {
  const s = input || {};
  const alerts = [];

  const recent = Array.isArray(s.recentScores) ? s.recentScores : [];
  const prior = Array.isArray(s.priorScores) ? s.priorScores : [];
  const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  if ((s.daysSinceActivity || 0) >= 5) {
    alerts.push({ type: 'inactive', severity: s.daysSinceActivity > 10 ? 'high' : 'medium' });
  }

  if ((s.questionsAsked || 0) > 5) {
    alerts.push({ type: 'too_many_questions', severity: 'medium' });
  }

  const r = mean(recent);
  const p = mean(prior);
  if (r !== null && p !== null && r - p >= 25) {
    alerts.push({ type: 'breakthrough', severity: 'low' });
  }

  return { alerts };
}

module.exports = {
  id: 'almanac',
  name: 'Almanac',
  description: 'Decides what is worth interrupting a teacher about.',
  run,
};
