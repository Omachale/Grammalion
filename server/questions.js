'use strict';

/**
 * questions.js — Server-side question pools.
 *
 * Reads the canonical question data from src/data/questions.json (the same
 * file the client uses). Pools are keyed by `${grammar}|${task}` so a single
 * grammar can support multiple task types (Multichoice vs Gap Fill).
 */

const data = require('../src/data/questions.json');

const QUESTION_POOLS = {
  // Multichoice
  'Present Simple|Multichoice':     data.multiChoice,
  'Verb Patterns|Multichoice':      data.multiChoiceVerbPatterns,
  // Gap Fill
  'Present Simple|Gap Fill':        data.gapFill,
  'Present Continuous|Gap Fill':    data.gapFillContinuous,
  'Past Simple|Gap Fill':           data.gapFillPast,
  'Verb Patterns|Gap Fill':         data.gapFillVerbPatterns,
};

module.exports = { QUESTION_POOLS };
