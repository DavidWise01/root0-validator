'use strict';

// ROOT0 Validator — programmatic API

const { validateAttribution }            = require('./attribution');
const { computeSHA256, checkSHA256,
        addKnownHash, KNOWN_HASHES }     = require('./sha');
const { SPEC, T, not, and, or,
        nextRung, resolve, stateCount }  = require('./ternary');

module.exports = {
  // Attribution
  validateAttribution,

  // SHA
  computeSHA256,
  checkSHA256,
  addKnownHash,
  KNOWN_HASHES,

  // Ternary
  TERNARY_SPEC: SPEC,
  T,
  trit: { not, and, or },
  ladder: { nextRung, resolve, stateCount },
};
