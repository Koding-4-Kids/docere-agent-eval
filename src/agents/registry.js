'use strict';

/**
 * The agent registry.
 *
 * Every agent the runner can evaluate registers here. The contract is
 * deliberately small — an agent is anything with an id and a `run` function.
 *
 *   {
 *     id:          string   stable identifier, also the gold-standard folder name
 *     name:        string   human-readable
 *     description: string   one line
 *     run:         async (input) => output
 *   }
 *
 * The agents in this repo are STUBS. They are deterministic, offline, and
 * deliberately imperfect — they make the kinds of mistakes a real component
 * makes, so that an evaluation suite run against them produces a non-trivial
 * result rather than a row of perfect scores.
 *
 * You are not expected to improve the stubs. You are expected to measure them.
 */

const grainWrite = require('./grainWrite');
const grainSurvey = require('./grainSurvey');
const almanac = require('./almanac');

const AGENTS = [grainWrite, grainSurvey, almanac];

function listAgents() {
  return AGENTS.slice();
}

function getAgent(id) {
  const agent = AGENTS.find(a => a.id === id);
  if (!agent) {
    throw new Error(
      `No agent registered with id "${id}". Registered: ${AGENTS.map(a => a.id).join(', ')}`
    );
  }
  return agent;
}

module.exports = { listAgents, getAgent };
