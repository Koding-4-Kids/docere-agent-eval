'use strict';

/**
 * Grain.survey (STUB)
 *
 * Answers a teacher's question about a whole classroom, drawing on the grains of
 * every student in it.
 *
 * This stub ignores the question when selecting grains — it concatenates
 * everything it has and lets the phrasing do the work. That is a real pattern in
 * systems like this, and it degrades as the number of grains grows rather than
 * failing outright.
 *
 * Its output is free text, which makes it a deliberately awkward scoring target.
 * A set-comparison metric will not transfer here. Deciding what to do about that
 * is part of the assignment.
 */

/**
 * @param {{
 *   question: string,
 *   students: Array<{ id: string, grains: Array<{text: string}> }>
 * }} input
 * @returns {Promise<{ answer: string, citedStudentIds: string[] }>}
 */
async function run(input) {
  const question = (input && input.question) || '';
  const students = (input && input.students) || [];

  const all = students.flatMap(s =>
    (s.grains || []).map(g => ({ studentId: s.id, text: g.text }))
  );

  if (all.length === 0) {
    return { answer: 'There is nothing recorded for this classroom yet.', citedStudentIds: [] };
  }

  const summary = all.map(g => g.text).join('; ');

  return {
    answer: `Regarding "${question}": ${summary}.`,
    citedStudentIds: [...new Set(all.map(g => g.studentId))],
  };
}

module.exports = {
  id: 'grain.survey',
  name: 'Grain.survey',
  description: "Answers a teacher's question across a whole classroom.",
  run,
};
