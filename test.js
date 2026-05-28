'use strict';

// ROOT0 Validator — test suite
// Run: node test.js

const { validateAttribution }   = require('./lib/attribution');
const { not, and, or, resolve } = require('./lib/ternary');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`\x1b[92m✓\x1b[0m  ${name}`);
    passed++;
  } catch (e) {
    console.log(`\x1b[91m✗\x1b[0m  ${name}`);
    console.log(`   ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ── Attribution validator tests ───────────────────────────────────────────

const VALID = {
  format: 'ROOT0-ATTRIBUTION-v1.0',
  project: 'test-project',
  law: 'Both work. Both fair.',
  contributors: [
    { name: 'ROOT0', substrate: 'human', role: 'architect', contribution: 'intent · direction' },
    { name: 'AVAN', substrate: 'synthetic', provider: 'Anthropic', model: 'Claude Sonnet 4.6', role: 'co-author', contribution: 'generation · execution' },
  ],
};

test('valid minimal file passes', () => {
  const r = validateAttribution(VALID);
  assert(r.valid, 'should be valid: ' + r.errors.join(', '));
});

test('wrong format string fails', () => {
  const r = validateAttribution({ ...VALID, format: 'OTHER-v1.0' });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('format')));
});

test('wrong law string fails', () => {
  const r = validateAttribution({ ...VALID, law: 'Both work.' });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('law')));
});

test('missing project fails', () => {
  const r = validateAttribution({ ...VALID, project: '' });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('project')));
});

test('empty contributors array fails', () => {
  const r = validateAttribution({ ...VALID, contributors: [] });
  assert(!r.valid);
});

test('synthetic without provider fails', () => {
  const c = { ...VALID.contributors[1] };
  delete c.provider;
  const r = validateAttribution({ ...VALID, contributors: [VALID.contributors[0], c] });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('provider')));
});

test('synthetic without model fails', () => {
  const c = { ...VALID.contributors[1] };
  delete c.model;
  const r = validateAttribution({ ...VALID, contributors: [VALID.contributors[0], c] });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('model')));
});

test('invalid role fails', () => {
  const c = { ...VALID.contributors[0], role: 'boss' };
  const r = validateAttribution({ ...VALID, contributors: [c] });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('role')));
});

test('invalid substrate fails', () => {
  const c = { ...VALID.contributors[0], substrate: 'robot' };
  const r = validateAttribution({ ...VALID, contributors: [c] });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('substrate')));
});

test('weights that sum to 1.0 pass', () => {
  const cs = [
    { ...VALID.contributors[0], weight: 0.6 },
    { ...VALID.contributors[1], weight: 0.4 },
  ];
  const r = validateAttribution({ ...VALID, contributors: cs });
  assert(r.valid, r.errors.join(', '));
});

test('weights that do not sum to 1.0 fail', () => {
  const cs = [
    { ...VALID.contributors[0], weight: 0.6 },
    { ...VALID.contributors[1], weight: 0.6 },
  ];
  const r = validateAttribution({ ...VALID, contributors: cs });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('sum')));
});

test('partial weights fail (not all contributors have weight)', () => {
  const cs = [
    { ...VALID.contributors[0], weight: 0.6 },
    { ...VALID.contributors[1] },  // no weight
  ];
  const r = validateAttribution({ ...VALID, contributors: cs });
  assert(!r.valid);
});

test('valid context field passes', () => {
  const r = validateAttribution({ ...VALID, context: 'code' });
  assert(r.valid, r.errors.join(', '));
});

test('invalid context field fails', () => {
  const r = validateAttribution({ ...VALID, context: 'vibe' });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('context')));
});

test('invalid date format fails', () => {
  const r = validateAttribution({ ...VALID, date: '28/05/2026' });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('date')));
});

test('valid date format passes', () => {
  const r = validateAttribution({ ...VALID, date: '2026-05-28' });
  assert(r.valid, r.errors.join(', '));
});

// ── Ternary operation tests ───────────────────────────────────────────────

test('NOT n1 = p1', () => { assert(not(-1) === 1); });
test('NOT p0 = p0', () => { assert(not(0)  === 0); });
test('NOT p1 = n1', () => { assert(not(1)  === -1); });

test('AND: min certainty dominates', () => {
  assert(and(1, -1) === -1);
  assert(and(1,  0) === 0);
  assert(and(1,  1) === 1);
  assert(and(0, -1) === -1);
});

test('OR: max certainty dominates', () => {
  assert(or(-1, 1) === 1);
  assert(or( 0, 1) === 1);
  assert(or(-1, 0) === 0);
  assert(or(-1,-1) === -1);
});

test('resolve: 3 zeros + gate = 000|1 safe', () => {
  const r = resolve([0, 0, 0, 1]);
  assert(r.safe === true, 'should be safe');
  assert(r.result === '000|1');
});

test('resolve: 4 zeros no gate = 00 00 bad', () => {
  const r = resolve([0, 0, 0, 0]);
  assert(r.safe === false, 'should be bad collapse');
  assert(r.result === '00 00');
});

// ── Summary ───────────────────────────────────────────────────────────────

console.log();
console.log('─'.repeat(40));
if (failed === 0) {
  console.log(`\x1b[92m${passed} tests passed\x1b[0m`);
  process.exit(0);
} else {
  console.log(`\x1b[91m${failed} failed\x1b[0m  \x1b[92m${passed} passed\x1b[0m`);
  process.exit(1);
}
