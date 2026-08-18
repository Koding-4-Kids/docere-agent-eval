'use strict';

/**
 * Grain.write (STUB)
 *
 * Reads a conversation and decides what is worth remembering about the student.
 * One remembered item is a "grain".
 *
 * This stub uses naive keyword rules. It is wrong in realistic ways: it fires on
 * phrasing rather than meaning, it has no notion of whether something is already
 * known, and it will happily extract from small talk. Those are the failures a
 * good evaluation suite should surface and quantify.
 */

const CUES = [
  { pattern: /\bi thought\b|\bi think\b|\bdoesn'?t that\b/i, type: 'misconception' },
  { pattern: /\boh\b.*\bmakes sense\b|\bi get it\b|\bit worked\b/i, type: 'understanding' },
  { pattern: /\bi don'?t (get|understand)\b|\bconfused\b|\bstuck\b/i, type: 'misconception' },
  { pattern: /\blike a\b|\bit'?s like\b/i, type: 'unstuck' },
];

/**
 * @param {{ turns: Array<{student: string, tutor: string}>, existingGrains?: Array<{text: string}> }} input
 * @returns {Promise<{ grains: Array<{text: string, type: string}> }>}
 */
async function run(input) {
  const turns = (input && input.turns) || [];
  const grains = [];

  for (const turn of turns) {
    const said = String(turn.student || '');
    for (const cue of CUES) {
      if (cue.pattern.test(said)) {
        grains.push({ text: said.trim(), type: cue.type });
        break; // one grain per turn at most
      }
    }
  }

  return { grains };
}

module.exports = {
  id: 'grain.write',
  name: 'Grain.write',
  description: 'Decides what is worth remembering from a finished conversation.',
  run,
};
