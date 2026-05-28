'use strict';

// ROOT0 Validator — test suite
// Run: node test.js

const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateAttribution }              = require('./lib/attribution');
const { not, and, or, resolve, stateCount, SPEC } = require('./lib/ternary');
const { scanDir, hasAttribution }          = require('./lib/scan');

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

// ── Doubt Ladder / stateCount tests ──────────────────────────────────────

test('stateCount(1) = 3', ()  => { assert(stateCount(1)  === 3); });
test('stateCount(3) = 27', () => { assert(stateCount(3)  === 27); });
test('stateCount(5) = 243', () => { assert(stateCount(5) === 243); });
test('stateCount(7) = 2187', () => { assert(stateCount(7) === 2187); });
test('stateCount(9) = 19683', () => { assert(stateCount(9) === 19683); });
test('stateCount(11) = 177147', () => { assert(stateCount(11) === 177147); });

test('SPEC.ladder has exactly 6 rungs', () => {
  assert(Array.isArray(SPEC.ladder));
  assert(SPEC.ladder.length === 6, `expected 6, got ${SPEC.ladder.length}`);
});

test('SPEC.ladder values are [1,3,5,7,9,11]', () => {
  const expected = [1, 3, 5, 7, 9, 11];
  expected.forEach((n, i) => {
    assert(SPEC.ladder[i] === n, `index ${i}: expected ${n}, got ${SPEC.ladder[i]}`);
  });
});

test('all rungs have mode and meaning', () => {
  SPEC.ladder.forEach(n => {
    const r = SPEC.rungs[n];
    assert(r && typeof r.mode === 'string' && r.mode.length > 0, `rung ${n} missing mode`);
    assert(r && typeof r.meaning === 'string' && r.meaning.length > 0, `rung ${n} missing meaning`);
  });
});

test('3^n growth: each rung is 9× the previous', () => {
  for (let i = 1; i < SPEC.ladder.length; i++) {
    const prev = stateCount(SPEC.ladder[i - 1]);
    const curr = stateCount(SPEC.ladder[i]);
    assert(curr === prev * 9, `rung ${SPEC.ladder[i]}: expected ${prev * 9}, got ${curr}`);
  }
});

// ── Scan tests ────────────────────────────────────────────────────────────

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r0-test-'));
  try { fn(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('hasAttribution: returns found:false when no file', () => {
  withTempDir(dir => {
    const r = hasAttribution(dir);
    assert(r.found === false, 'expected found:false');
  });
});

test('hasAttribution: returns found:true + valid:false for bad JSON', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, '.attribution'), 'not json', 'utf8');
    const r = hasAttribution(dir);
    assert(r.found === true, 'expected found:true');
    assert(r.valid === false, 'expected valid:false');
    assert(r.errors.length > 0, 'expected at least one error');
  });
});

test('hasAttribution: returns found:true + valid:true for valid file', () => {
  withTempDir(dir => {
    const obj = {
      format: 'ROOT0-ATTRIBUTION-v1.0',
      project: 'scan-test',
      law: 'Both work. Both fair.',
      contributors: [
        { name: 'ROOT0', substrate: 'human', role: 'architect', contribution: 'intent · direction' },
      ],
    };
    fs.writeFileSync(path.join(dir, '.attribution'), JSON.stringify(obj), 'utf8');
    const r = hasAttribution(dir);
    assert(r.found === true, 'expected found:true');
    assert(r.valid === true, `expected valid:true — errors: ${(r.errors || []).join(', ')}`);
  });
});

test('scanDir: detects project dir with package.json', () => {
  withTempDir(rootDir => {
    const proj = path.join(rootDir, 'my-project');
    fs.mkdirSync(proj);
    fs.writeFileSync(path.join(proj, 'package.json'), '{}', 'utf8');
    const results = scanDir(rootDir);
    assert(results.length === 1, `expected 1 project, got ${results.length}`);
    assert(results[0].found === false, 'should have no .attribution');
  });
});

test('scanDir: project with valid .attribution is covered', () => {
  withTempDir(rootDir => {
    const proj = path.join(rootDir, 'good-proj');
    fs.mkdirSync(proj);
    fs.writeFileSync(path.join(proj, 'package.json'), '{}', 'utf8');
    const obj = {
      format: 'ROOT0-ATTRIBUTION-v1.0',
      project: 'good-proj',
      law: 'Both work. Both fair.',
      contributors: [
        { name: 'ROOT0', substrate: 'human', role: 'architect', contribution: 'intent' },
      ],
    };
    fs.writeFileSync(path.join(proj, '.attribution'), JSON.stringify(obj), 'utf8');
    const results = scanDir(rootDir);
    assert(results.length === 1, `expected 1, got ${results.length}`);
    assert(results[0].found === true, 'should find .attribution');
    assert(results[0].valid === true, `should be valid — ${(results[0].errors || []).join(', ')}`);
  });
});

test('scanDir: skips node_modules', () => {
  withTempDir(rootDir => {
    const nm = path.join(rootDir, 'node_modules', 'some-pkg');
    fs.mkdirSync(nm, { recursive: true });
    fs.writeFileSync(path.join(nm, 'package.json'), '{}', 'utf8');
    const results = scanDir(rootDir);
    assert(results.length === 0, `should skip node_modules — got ${results.length}`);
  });
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
