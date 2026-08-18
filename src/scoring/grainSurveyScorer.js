'use strict';

/**
 * grainSurveyScorer
 *
 * Multidimensional, cost-sensitive scorer for Grain.survey.
 *
 * Evaluates:
 *   1. Citation Accuracy: Precision-weighted F-beta (beta = 0.5) over canonical student IDs.
 *      Prioritizes Precision 2x over Recall to penalize falsely accusing innocent students.
 *   2. Empty Set & Abstention Verification: Zero-expected cases require explicit negative-state
 *      phrasing (e.g. "no students found", "none recorded") to receive citation credit.
 *      Silent answers or hallucinated citations receive 0.0.
 *   3. Pedagogical Text Assertions:
 *      - mustMention: Concept groups with synonym banks (evaluates coverage).
 *      - mustNotMention: Forbidden distractor IDs/terms (penalized with 1.5x penalty).
 *   4. Diagnostics: Detailed breakdown including token estimate and explanatory verdict.
 */

const NEGATIVE_STATE_PHRASES = [
  /\bno students\b/i,
  /\bnone recorded\b/i,
  /\bno matches\b/i,
  /\bempty classroom\b/i,
  /\bzero students\b/i,
  /\bnothing recorded\b/i,
  /\bno one\b/i,
  /\bno student\b/i,
  /\bnone found\b/i,
  /\bno struggling students\b/i,
  /\bno difficulties recorded\b/i,
  /\bno matching students\b/i,
  /\bnothing\b/i,
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

  // 1. Citation extraction and canonicalization
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

  const rawMustMention = Array.isArray(exp.mustMention) ? exp.mustMention : [];
  const rawMustNotMention = Array.isArray(exp.mustNotMention) ? exp.mustNotMention : [];

  let textScore = 0.0;
  let conceptCoverage = 0.0;
  const leakedDistractors = [];
  const matchedMentions = [];
  const missedMentions = [];

  if (expectedCited.length === 0) {
    if (actualCited.length === 0) {
      // Empty expected & empty actual: verify explicit negative-state phrasing
      abstentionVerified = NEGATIVE_STATE_PHRASES.some(p => p.test(answerText) || p.test(normalizedText));
      if (abstentionVerified) {
        precision = 1.0;
        recall = 1.0;
        f05 = 1.0;
        citationScore = 1.0;
        conceptCoverage = 1.0;
        textScore = 1.0;
      } else {
        precision = 0.0;
        recall = 0.0;
        f05 = 0.0;
        citationScore = 0.0;
        conceptCoverage = 0.0;
        textScore = 0.0;
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
      conceptCoverage = 0.0;
      textScore = 0.0;
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

    // 2. Pedagogical Text Assertions (mustMention & mustNotMention)
    let matchedGroupsCount = 0;
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

    conceptCoverage = rawMustMention.length > 0 ? matchedGroupsCount / rawMustMention.length : 1.0;

    for (const forbidden of rawMustNotMention) {
      if (matchesPattern(answerText, normalizedText, forbidden)) {
        leakedDistractors.push(forbidden);
      }
    }

    const distractorLeaksCount = leakedDistractors.length;
    const leakFraction = rawMustNotMention.length > 0 ? distractorLeaksCount / rawMustNotMention.length : 0.0;
    const distractorPenaltyCoeff = typeof exp.distractorPenaltyCoeff === 'number' ? exp.distractorPenaltyCoeff : 1.5;
    textScore = Math.max(0.0, conceptCoverage - (distractorPenaltyCoeff * leakFraction));
  }

  // 3. Composite Output Score
  const citationWeight = typeof exp.citationWeight === 'number' ? exp.citationWeight : 0.65;
  const textWeight = typeof exp.textWeight === 'number' ? exp.textWeight : 0.35;

  const rawComposite = (citationWeight * citationScore) + (textWeight * textScore);
  const finalScore = Number(Math.min(1.0, Math.max(0.0, rawComposite)).toFixed(4));

  // Explanation string
  const explanations = [];
  if (expectedCited.length === 0) {
    if (actualCited.length === 0) {
      explanations.push(abstentionVerified ? 'Correctly abstained with negative-state explanation.' : 'Empty citation without explicit negative-state phrasing.');
    } else {
      explanations.push(`Falsely cited ${actualCited.length} student(s) when 0 expected.`);
    }
  } else {
    explanations.push(`Citations: P=${precision.toFixed(2)}, R=${recall.toFixed(2)}, F0.5=${f05.toFixed(2)} (TP:${truePositives}, FP:${falsePositives}, FN:${falseNegatives}).`);
  }

  if (rawMustMention.length > 0 && expectedCited.length > 0) {
    explanations.push(`Concept coverage: ${(conceptCoverage * 100).toFixed(0)}% (${matchedMentions.length}/${rawMustMention.length}).`);
  }
  if (leakedDistractors.length > 0) {
    explanations.push(`Distractor penalty: leaked [${leakedDistractors.join(', ')}].`);
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
      distractorLeaks: leakedDistractors.length,
      leakedDistractors,
      matchedMentions,
      missedMentions,
      tokenEstimate,
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
