'use strict';

/**
 * grainSurveyScorer (v2.1)
 *
 * Multidimensional, cost-sensitive scorer for Grain.survey with Citation Gating,
 * Universal Distractor Verification, and Length Efficiency Penalties.
 *
 * Core Principles:
 *   1. Citation-Gated Formulation: Text scoring is strictly conditioned on citation success:
 *        Score = citationScore * ((1 - textWeight) + textWeight * textScore) * lengthMultiplier
 *      If an agent fails citations (citationScore = 0.0), the total score is strictly 0.0,
 *      preventing agents from banking 0.35 for ungrounded keyword matching.
 *   2. Asymmetric Precision Weighting: Precision is weighted 2x over Recall (beta = 0.5)
 *      to heavily penalize misdiagnosing innocent students.
 *   3. Universal Distractor Verification: mustNotMention and mustMention are evaluated across
 *      ALL cases. On zero-expected cases, leaking a forbidden distractor invalidates abstention.
 *   4. Length Efficiency Penalty: Proactively penalizes raw text dumping when output
 *      significantly exceeds a realistic pedagogical summary length budget.
 *   5. Negative-State Abstention Verification: Tight phrase bank ensuring empty citation
 *      credit is only awarded when the agent explicitly states that no matching students were found.
 */

const NEGATIVE_STATE_PHRASES = [
  /\bno students\b/i,
  /\bnone recorded\b/i,
  /\bno matches\b/i,
  /\bempty classroom\b/i,
  /\bzero students\b/i,
  /\bnothing recorded\b/i,
  /\bnothing found\b/i,
  /\bno student recorded\b/i,
  /\bno struggling students\b/i,
  /\bno difficulties recorded\b/i,
  /\bno matching students\b/i,
  /\bno students struggling\b/i,
  /\bnone found with\b/i,
  /\bthere is nothing recorded\b/i,
];

function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesPattern(text, normalizedText, pattern) {
  if (pattern instanceof RegExp) {
    return pattern.test(text) || pattern.test(normalizedText);
  }
  const needle = String(pattern || '').toLowerCase().trim();
  if (!needle) return false;
  const cleanNeedle = needle.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanNeedle) return false;
  return normalizedText.includes(cleanNeedle) || text.toLowerCase().includes(needle);
}

function score({ actual, expected, testCase }) {
  const exp = expected || {};
  const act = actual || {};

  const answerText = typeof act.answer === 'string' ? act.answer : '';
  const normalizedText = normalizeText(answerText);
  const tokenEstimate = answerText.trim()
    ? Math.ceil(answerText.trim().split(/\s+/).filter(Boolean).length * 1.33)
    : 0;

  // 1. Universal Distractor & Assertion Checking
  const rawMustMention = Array.isArray(exp.mustMention) ? exp.mustMention : [];
  const rawMustNotMention = Array.isArray(exp.mustNotMention) ? exp.mustNotMention : [];

  let matchedGroupsCount = 0;
  const matchedMentions = [];
  const missedMentions = [];

  if (rawMustMention.length === 0) {
    matchedGroupsCount = 1;
  } else {
    for (const group of rawMustMention) {
      const synonyms = Array.isArray(group) ? group : [group];
      const matchedSynonym = synonyms.find(syn => matchesPattern(answerText, normalizedText, syn));
      if (matchedSynonym) {
        matchedGroupsCount++;
        matchedMentions.push(synonyms[0]);
      } else {
        missedMentions.push(synonyms[0]);
      }
    }
  }

  const conceptCoverage = rawMustMention.length > 0 ? matchedGroupsCount / rawMustMention.length : 1.0;

  const leakedDistractors = [];
  for (const forbidden of rawMustNotMention) {
    if (matchesPattern(answerText, normalizedText, forbidden)) {
      leakedDistractors.push(forbidden);
    }
  }

  const distractorLeaksCount = leakedDistractors.length;
  const leakFraction = rawMustNotMention.length > 0 ? distractorLeaksCount / rawMustNotMention.length : 0.0;
  const distractorPenaltyCoeff = typeof exp.distractorPenaltyCoeff === 'number' ? exp.distractorPenaltyCoeff : 1.5;

  // 2. Citation extraction and canonicalization
  const actualCited = Array.isArray(act.citedStudentIds)
    ? [...new Set(act.citedStudentIds.map(String).map(s => s.trim()).filter(Boolean))]
    : [];
  const expectedCited = Array.isArray(exp.citedStudentIds)
    ? [...new Set(exp.citedStudentIds.map(String).map(s => s.trim()).filter(Boolean))]
    : [];

  const expectedSet = new Set(expectedCited);
  const actualSet = new Set(actualCited);

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let precision = 0.0;
  let recall = 0.0;
  let f05 = 0.0;
  let citationScore = 0.0;
  let abstentionVerified = false;

  const beta = typeof exp.beta === 'number' ? exp.beta : 0.5;
  const betaSq = beta * beta;

  if (expectedCited.length === 0) {
    if (actualCited.length === 0) {
      // Empty expected & empty actual: verify explicit negative-state phrasing AND no distractor leaks
      const hasNegativePhrase = NEGATIVE_STATE_PHRASES.some(p => p.test(answerText) || p.test(normalizedText));
      abstentionVerified = hasNegativePhrase && distractorLeaksCount === 0;

      if (abstentionVerified) {
        precision = 1.0;
        recall = 1.0;
        f05 = 1.0;
        citationScore = 1.0;
      } else {
        precision = 0.0;
        recall = 0.0;
        f05 = 0.0;
        citationScore = 0.0;
      }
    } else {
      // Hallucinated citations on empty expectation
      truePositives = 0;
      falsePositives = actualCited.length;
      falseNegatives = 0;
      precision = 0.0;
      recall = 0.0;
      f05 = 0.0;
      citationScore = 0.0;
    }
  } else {
    // Non-empty expected citations
    if (actualCited.length === 0) {
      truePositives = 0;
      falsePositives = 0;
      falseNegatives = expectedCited.length;
      precision = 0.0;
      recall = 0.0;
      f05 = 0.0;
      citationScore = 0.0;
    } else {
      truePositives = actualCited.filter(id => expectedSet.has(id)).length;
      falsePositives = actualCited.filter(id => !expectedSet.has(id)).length;
      falseNegatives = expectedCited.filter(id => !actualSet.has(id)).length;

      precision = (truePositives + falsePositives) > 0 ? truePositives / (truePositives + falsePositives) : 0.0;
      recall = (truePositives + falseNegatives) > 0 ? truePositives / (truePositives + falseNegatives) : 0.0;

      if (precision + recall > 0) {
        f05 = ((1 + betaSq) * (precision * recall)) / ((betaSq * precision) + recall);
      } else {
        f05 = 0.0;
      }
      citationScore = f05;
    }
  }

  // 3. Text Score Calculation
  let baseTextScore = conceptCoverage;
  if (expectedCited.length === 0 && !abstentionVerified) {
    baseTextScore = 0.0;
  }
  const textScore = Math.max(0.0, baseTextScore - (distractorPenaltyCoeff * leakFraction));

  // 4. Length Efficiency & Verbosity Penalty
  // Target length budget: 120 tokens base + 40 tokens per cited student
  const maxAllowedTokens = typeof exp.maxAllowedTokens === 'number'
    ? exp.maxAllowedTokens
    : Math.max(120, (expectedCited.length || 1) * 40 + 80);

  let lengthMultiplier = 1.0;
  if (tokenEstimate > maxAllowedTokens) {
    const excessRatio = (tokenEstimate - maxAllowedTokens) / maxAllowedTokens;
    lengthMultiplier = Math.max(0.4, 1.0 / (1.0 + 0.6 * excessRatio));
  }

  // 5. Citation-Gated Composite Score
  // Text fidelity is conditioned on citation performance:
  // If citationScore == 0, composite is strictly 0.0.
  // If citationScore > 0, textScore scales the textWeight portion.
  const citationWeight = typeof exp.citationWeight === 'number' ? exp.citationWeight : 0.65;
  const textWeight = typeof exp.textWeight === 'number' ? exp.textWeight : 0.35;

  const gatedComposite = citationScore * ((1 - textWeight) + (textWeight * textScore));
  const penalizedComposite = gatedComposite * lengthMultiplier;
  const finalScore = Number(Math.min(1.0, Math.max(0.0, penalizedComposite)).toFixed(4));

  // Explanation string
  const explanations = [];
  if (expectedCited.length === 0) {
    if (actualCited.length === 0) {
      if (distractorLeaksCount > 0) {
        explanations.push(`Abstention invalidated by distractor leak: [${leakedDistractors.join(', ')}].`);
      } else {
        explanations.push(abstentionVerified ? 'Correctly abstained with negative-state explanation.' : 'Empty citation without explicit negative-state phrasing.');
      }
    } else {
      explanations.push(`Falsely cited ${actualCited.length} student(s) when 0 expected.`);
    }
  } else {
    explanations.push(`Citations: P=${precision.toFixed(2)}, R=${recall.toFixed(2)}, F0.5=${f05.toFixed(2)} (TP:${truePositives}, FP:${falsePositives}, FN:${falseNegatives}).`);
  }

  if (rawMustMention.length > 0) {
    explanations.push(`Concept coverage: ${(conceptCoverage * 100).toFixed(0)}% (${matchedMentions.length}/${rawMustMention.length}).`);
  }
  if (leakedDistractors.length > 0) {
    explanations.push(`Distractor penalty: leaked [${leakedDistractors.join(', ')}].`);
  }
  if (lengthMultiplier < 0.98) {
    explanations.push(`Verbosity penalty: ${tokenEstimate} tokens exceeds budget of ${maxAllowedTokens} (multiplier: ${lengthMultiplier.toFixed(2)}).`);
  }

  return {
    score: finalScore,
    detail: {
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f05: Number(f05.toFixed(4)),
      truePositives,
      falsePositives,
      falseNegatives,
      conceptCoverage: Number(conceptCoverage.toFixed(4)),
      distractorLeaks: distractorLeaksCount,
      leakedDistractors,
      matchedMentions,
      missedMentions,
      tokenEstimate,
      maxAllowedTokens,
      lengthMultiplier: Number(lengthMultiplier.toFixed(4)),
      textScore: Number(textScore.toFixed(4)),
      citationScore: Number(citationScore.toFixed(4)),
      abstentionVerified,
      explanation: explanations.join(' '),
    },
  };
}

module.exports = {
  id: 'grainSurveyScorer',
  score,
};
