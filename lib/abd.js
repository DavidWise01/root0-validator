'use strict';

// ROOT0 ABD Law Engine — A (anchor/n1) · B (witness/p0) · C (law/p1)

const { not, and, or } = require('./ternary');

// Canonical trit positions
const POS = { A: -1, B: 0, C: 1 };

// Evaluate a full ABD triword and return structured analysis
function evaluateABD(labelA, labelC, labelB) {
  const a = POS.A;   // n1 — anchor, always -1
  const b = POS.B;   // p0 — witness, always 0
  const c = POS.C;   // p1 — law, always +1

  const notA   = not(a);   // +1
  const notC   = not(c);   // -1
  const andAC  = and(a, c); // -1  (anchor dominates)
  const orAC   = or(a, c);  // +1  (law survives)
  const andAB  = and(a, b); // -1  (shadow + doubt)
  const orBC   = or(b, c);  // +1  (witness yields to law)

  // The key balance check: NOT(A) should equal C (+1)
  const balanced = notA === c;
  // The inversion check: NOT(C) should equal A (-1)
  const inverted = notC === a;

  // Ground-state derivation from ABD trit positions
  // Three witnesses (if B is the middle, A and C flank) → safe when balanced
  const groundSafe = balanced && inverted;

  return {
    positions: { a, b, c },
    labels:    { A: labelA, B: labelB || null, C: labelC },
    ops: { notA, notC, andAC, orAC, andAB, orBC },
    balanced,
    inverted,
    groundSafe,
  };
}

// Format a trit value for display (+1, 0, -1)
function tritStr(v) {
  if (v ===  1) return '+1';
  if (v === -1) return '-1';
  return ' 0';
}

module.exports = { evaluateABD, tritStr, POS };
