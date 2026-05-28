'use strict';

// ROOT0 Ternary Logic Spec v1.0 — constants and operations
// https://github.com/DavidWise01/ternary-spec

const SPEC = {
  version:   'ROOT0-TERNARY-SPEC-v1.0',
  states: {
    n1: { value: -1, name: 'Negative One', role: 'shadow · anchor · boundary' },
    p0: { value:  0, name: 'Positive Zero', role: 'null · witness · doubt · the gap' },
    p1: { value:  1, name: 'Positive One',  role: 'signal · law · truth · resolved' },
  },
  primitive:  '0 . 0',
  ladder:     [1, 3, 5, 7, 9, 11],
  rungs: {
    1:  { mode: 'SELF',         states: Math.pow(3,1),  meaning: 'one quantum doubt — the dot that can choose' },
    3:  { mode: 'GROUP',        states: Math.pow(3,3),  meaning: 'left-dot-right — first triword frame' },
    5:  { mode: 'COLLECT',      states: Math.pow(3,5),  meaning: 'collect witnesses, sort signal from noise' },
    7:  { mode: 'COLLATE/SEND', states: Math.pow(3,7),  meaning: 'send scouts while preserving a core' },
    9:  { mode: 'PROPAGATE',    states: Math.pow(3,9),  meaning: '3×3 broadcast plane — full propagation' },
    11: { mode: 'REPEAT',       states: Math.pow(3,11), meaning: 'scouts return — loop closes — repeat' },
  },
  ground: {
    safe:    '000|1',
    bad:     '00 00',
    safe_meaning: 'three witnesses through gate → one signal survives',
    bad_meaning:  'no gate, no remainder — signal destroyed',
  },
  genesis:   '1 = 0 = 1',
  core_law:  'ground doubt to hold truth',
  rules: {
    power_of_2: 'double to control',
    odd_ladder: 'add witnesses to talk',
  },
  abd: { A: 'n1 · anchor · containment', B: 'p0 · witness · modulation', C: 'p1 · law · synthesis' },
  universe:  '20 (Light) + 20 (Shadow) + 2 (Observers) = 42 = 1',
  mimz_vector: [-1, 0, 0, 1, 0, 0],   // simplified; full: [-1, -i, 0, 0, 1, i, 0, 0]
};

// ── Trit operations ───────────────────────────────────────────────────────

const T = { n1: -1, p0: 0, p1: 1 };

function not(a) {
  return -a;  // n1→p1, p0→p0, p1→n1
}

function and(a, b) {
  return Math.min(a, b);  // minimum certainty dominates
}

function or(a, b) {
  return Math.max(a, b);  // maximum certainty dominates
}

// Step through the doubt ladder from current rung
function nextRung(currentRung) {
  const idx  = SPEC.ladder.indexOf(currentRung);
  if (idx === -1 || idx === SPEC.ladder.length - 1) return SPEC.ladder[0]; // wrap
  return SPEC.ladder[idx + 1];
}

// Attempt to resolve a sequence of trits to 000|1 (safe) or 00 00 (bad)
function resolve(trits) {
  const zeros  = trits.filter(t => t === 0).length;
  const hasGate = trits.some(t => t !== 0); // at least one non-zero = gate exists
  if (zeros >= 3 && hasGate) return { result: '000|1', safe: true };
  if (zeros >= 3 && !hasGate) return { result: '00 00', safe: false };
  if (zeros === 0) return { result: 'p1', safe: true };
  return { result: 'unresolved', safe: null };
}

// Compute 3^n for a given rung
function stateCount(rung) {
  return Math.pow(3, rung);
}

module.exports = { SPEC, T, not, and, or, nextRung, resolve, stateCount };
