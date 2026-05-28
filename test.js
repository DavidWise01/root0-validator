'use strict';

// ROOT0 Validator — test suite
// Run: node test.js

const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateAttribution }                       = require('./lib/attribution');
const { not, and, or, resolve, stateCount, SPEC }   = require('./lib/ternary');
const { scanDir, hasAttribution }                   = require('./lib/scan');
const { evaluateABD, tritStr, POS }                 = require('./lib/abd');
const { parseAttributionResponse, runBatch }        = require('./lib/audit');
const { buildLocalChain, isCertified, resolveFramework,
        extractGitHubCoords, KNOWN_FRAMEWORKS }     = require('./lib/lineage');
const { lineageAsciiBadge, lineageMarkdownBadge }   = require('./lib/badge');
const { loadProfile, saveProfile, buildAttribution,
        stampDir, stampAll, DEFAULT_PROFILE }       = require('./lib/stamp');
const { markdownBadge, htmlBadge, asciiBadge, summariseBadge } = require('./lib/badge');
const { registerHash, loadUserRegistry, removeHash, REGISTRY_PATH } = require('./lib/register');

let passed = 0, failed = 0;
const asyncTests = [];   // collect async tests to await before printing summary

function test(name, fn) {
  let result;
  try {
    result = fn();
  } catch (e) {
    // Sync throw
    console.log(`\x1b[91m✗\x1b[0m  ${name}`);
    console.log(`   ${e.message}`);
    failed++;
    return;
  }

  // Async test — fn returned a Promise
  if (result && typeof result.then === 'function') {
    const p = result
      .then(() => {
        console.log(`\x1b[92m✓\x1b[0m  ${name}`);
        passed++;
      })
      .catch(e => {
        console.log(`\x1b[91m✗\x1b[0m  ${name}`);
        console.log(`   ${e.message}`);
        failed++;
      });
    asyncTests.push(p);
    return;
  }

  // Sync pass
  console.log(`\x1b[92m✓\x1b[0m  ${name}`);
  passed++;
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

// ── ABD Law Engine tests ──────────────────────────────────────────────────

test('POS: A=-1, B=0, C=+1', () => {
  assert(POS.A === -1);
  assert(POS.B ===  0);
  assert(POS.C ===  1);
});

test('tritStr formats correctly', () => {
  assert(tritStr( 1) === '+1');
  assert(tritStr(-1) === '-1');
  assert(tritStr( 0) ===  ' 0');
});

test('evaluateABD: canonical A/C balanced', () => {
  const r = evaluateABD('shadow', 'law');
  assert(r.balanced === true,    'should be balanced');
  assert(r.groundSafe === true,  'should be ground-safe');
  assert(r.ops.notA  ===  1,    'NOT(A) should be +1');
  assert(r.ops.notC  === -1,    'NOT(C) should be -1');
  assert(r.ops.andAC === -1,    'AND(A,C) should be -1');
  assert(r.ops.orAC  ===  1,    'OR(A,C) should be +1');
});

test('evaluateABD: labels stored correctly', () => {
  const r = evaluateABD('anchor-text', 'law-text', 'witness-text');
  assert(r.labels.A === 'anchor-text');
  assert(r.labels.B === 'witness-text');
  assert(r.labels.C === 'law-text');
});

test('evaluateABD: B label is null when omitted', () => {
  const r = evaluateABD('A', 'C');
  assert(r.labels.B === null);
});

test('evaluateABD: NOT(A) always equals C', () => {
  // By definition of the ABD framework, NOT(n1) = p1
  const r = evaluateABD('anything', 'anything-else');
  assert(r.ops.notA === POS.C, 'NOT(A) must equal C');
});

test('evaluateABD: OR(B,C) always equals C (+1)', () => {
  // p0 OR p1 = max = p1
  const r = evaluateABD('a', 'c');
  assert(r.ops.orBC === 1);
});

// ── Badge tests ───────────────────────────────────────────────────────────

test('markdownBadge: valid produces cyan badge markdown', () => {
  const md = markdownBadge('my-project', true);
  assert(md.includes('!['), 'should be markdown img');
  assert(md.includes('67e8f9'), 'valid should use cyan color');
  assert(md.includes('attribution-standard'), 'should link to attribution-standard');
});

test('markdownBadge: invalid produces red badge markdown', () => {
  const md = markdownBadge('my-project', false);
  assert(md.includes('ef4444'), 'invalid should use red color');
});

test('asciiBadge: valid shows checkmark', () => {
  const b = asciiBadge(true);
  assert(b.includes('✓'));
  assert(b.includes('ROOT0'));
});

test('asciiBadge: invalid shows cross', () => {
  const b = asciiBadge(false);
  assert(b.includes('✗'));
});

test('htmlBadge: produces img tag', () => {
  const h = htmlBadge('my-project', true);
  assert(h.includes('<img'));
  assert(h.includes('<a href='));
});

test('summariseBadge: extracts project and contributors', () => {
  const obj = {
    project: 'test-proj',
    law: 'Both work. Both fair.',
    contributors: [
      { name: 'ROOT0', substrate: 'human', role: 'architect', contribution: 'intent' },
    ],
  };
  const s = summariseBadge(obj);
  assert(s.project === 'test-proj');
  assert(s.contributors.length === 1);
  assert(s.contributors[0].includes('ROOT0'));
});

// ── Register tests ────────────────────────────────────────────────────────

const TEST_SHA = 'a'.repeat(64);
const TEST_NAME = '__r0-test-asset__';

// Clean up test entry if it exists from a prior run
try { removeHash(TEST_SHA); } catch {}

test('registerHash: saves to user registry', () => {
  const r = registerHash(TEST_SHA, TEST_NAME);
  assert(r.hash === TEST_SHA);
  assert(r.entry.name === TEST_NAME);
  assert(typeof r.registryPath === 'string');
  assert(!r.isUpdate, 'should be a new entry');
});

test('registerHash: can be read back', () => {
  const reg = loadUserRegistry();
  assert(reg[TEST_SHA], 'entry should exist');
  assert(reg[TEST_SHA].name === TEST_NAME);
});

test('registerHash: update sets isUpdate flag', () => {
  const r = registerHash(TEST_SHA, TEST_NAME + '-v2');
  assert(r.isUpdate === true);
  assert(r.entry.name === TEST_NAME + '-v2');
});

test('removeHash: deletes entry from registry', () => {
  const removed = removeHash(TEST_SHA);
  assert(removed === true, 'should return true');
  const reg = loadUserRegistry();
  assert(!reg[TEST_SHA], 'entry should be gone');
});

test('registerHash: rejects short sha', () => {
  let threw = false;
  try { registerHash('abc', 'test'); } catch { threw = true; }
  assert(threw, 'should throw on short sha');
});

test('registerHash: rejects empty name', () => {
  let threw = false;
  try { registerHash(TEST_SHA, ''); } catch { threw = true; }
  assert(threw, 'should throw on empty name');
});

// ── Audit helper tests (no real API calls) ────────────────────────────────

function makeGitHubContentsBody(attrObj) {
  const json    = JSON.stringify(attrObj);
  const b64     = Buffer.from(json).toString('base64');
  // GitHub wraps content in chunks with \n — simulate that
  return JSON.stringify({ content: b64 + '\n', encoding: 'base64', name: '.attribution' });
}

const VALID_ATTR = {
  format: 'ROOT0-ATTRIBUTION-v1.0',
  project: 'audit-test',
  law: 'Both work. Both fair.',
  contributors: [
    { name: 'ROOT0', substrate: 'human', role: 'architect', contribution: 'intent · direction' },
  ],
};

test('parseAttributionResponse: valid content returns valid:true', () => {
  const body = makeGitHubContentsBody(VALID_ATTR);
  const r    = parseAttributionResponse(body);
  assert(r.found  === true,  'found should be true');
  assert(r.valid  === true,  `valid should be true — ${(r.errors || []).join(', ')}`);
  assert(r.errors.length === 0, 'should have no errors');
});

test('parseAttributionResponse: invalid attr returns valid:false', () => {
  const bad = { ...VALID_ATTR, law: 'wrong law' };
  const body = makeGitHubContentsBody(bad);
  const r    = parseAttributionResponse(body);
  assert(r.found  === true);
  assert(r.valid  === false, 'should be invalid');
  assert(r.errors.length  > 0, 'should have errors');
});

test('parseAttributionResponse: malformed JSON in base64 returns parse error', () => {
  const b64  = Buffer.from('not json at all').toString('base64');
  const body = JSON.stringify({ content: b64, encoding: 'base64' });
  const r    = parseAttributionResponse(body);
  assert(r.found  === true);
  assert(r.valid  === false);
  assert(r.errors[0].includes('parse error'));
});

test('parseAttributionResponse: bad outer JSON returns parse error', () => {
  const r = parseAttributionResponse('this is not json');
  assert(r.found  === true);
  assert(r.valid  === false);
  assert(r.errors.length > 0);
});

test('parseAttributionResponse: preserves project name', () => {
  const body = makeGitHubContentsBody(VALID_ATTR);
  const r    = parseAttributionResponse(body);
  assert(r.project === 'audit-test');
});

test('runBatch: runs all tasks', async () => {
  const results = await runBatch([
    () => Promise.resolve(1),
    () => Promise.resolve(2),
    () => Promise.resolve(3),
    () => Promise.resolve(4),
    () => Promise.resolve(5),
    () => Promise.resolve(6),
  ], 3);
  assert(results.length === 6);
  assert(results[0] === 1 && results[5] === 6);
});

test('runBatch: batch size 1 still runs all tasks', async () => {
  const log = [];
  await runBatch([
    () => Promise.resolve(log.push('a')),
    () => Promise.resolve(log.push('b')),
    () => Promise.resolve(log.push('c')),
  ], 1);
  assert(log.join('') === 'abc');
});

test('runBatch: empty task array returns empty results', async () => {
  const r = await runBatch([], 5);
  assert(Array.isArray(r) && r.length === 0);
});

// ── Lineage tracker tests ─────────────────────────────────────────────────

const WITH_FRAMEWORK = {
  ...VALID_ATTR,
  framework: 'STOICHEION v11.0',
};

const WITH_PARENT = {
  ...VALID_ATTR,
  framework:  'STOICHEION v11.0',
  parent:     'https://github.com/DavidWise01/root0-registry',
};

const NO_FRAMEWORK = { ...VALID_ATTR };

test('resolveFramework: STOICHEION v11.0 resolves', () => {
  const fw = resolveFramework('STOICHEION v11.0');
  assert(fw !== null, 'should resolve');
  assert(fw.sha256 === '02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763');
  assert(fw.prior_art === '2026-02-02');
});

test('resolveFramework: partial name resolves', () => {
  const fw = resolveFramework('STOICHEION');
  assert(fw !== null, 'should resolve partial');
  assert(fw.name === 'STOICHEION v11.0');
});

test('resolveFramework: unknown framework returns null', () => {
  const fw = resolveFramework('MYSTERY v99.0');
  assert(fw === null);
});

test('resolveFramework: null/undefined returns null', () => {
  assert(resolveFramework(null)      === null);
  assert(resolveFramework(undefined) === null);
  assert(resolveFramework('')        === null);
});

test('buildLocalChain: no framework → chain length 1', () => {
  const chain = buildLocalChain(NO_FRAMEWORK);
  assert(chain.length === 1, `expected 1, got ${chain.length}`);
  assert(chain[0].type === 'project');
});

test('buildLocalChain: with known framework → chain length 3', () => {
  const chain = buildLocalChain(WITH_FRAMEWORK);
  assert(chain.length === 3, `expected 3, got ${chain.length}`);
  assert(chain[0].type === 'project');
  assert(chain[1].type === 'framework');
  assert(chain[2].type === 'foundation');
});

test('buildLocalChain: framework link has correct sha256', () => {
  const chain = buildLocalChain(WITH_FRAMEWORK);
  const fw    = chain.find(l => l.type === 'framework');
  assert(fw.verified === true);
  assert(fw.sha256 === '02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763');
});

test('buildLocalChain: foundation link is certified', () => {
  const chain = buildLocalChain(WITH_FRAMEWORK);
  const found = chain.find(l => l.type === 'foundation');
  assert(found, 'foundation link missing');
  assert(found.certified === true);
});

test('buildLocalChain: unknown framework → chain length 2, not certified', () => {
  const chain = buildLocalChain({ ...VALID_ATTR, framework: 'MYSTERY v99.0' });
  assert(chain.length === 2, `expected 2, got ${chain.length}`);
  assert(chain[1].type === 'framework');
  assert(chain[1].verified === false);
});

test('isCertified: chain with known framework = true', () => {
  assert(isCertified(buildLocalChain(WITH_FRAMEWORK)) === true);
});

test('isCertified: chain without framework = false', () => {
  assert(isCertified(buildLocalChain(NO_FRAMEWORK)) === false);
});

test('isCertified: chain with unknown framework = false', () => {
  assert(isCertified(buildLocalChain({ ...VALID_ATTR, framework: 'UNKNOWN v0' })) === false);
});

test('buildLocalChain: stores parent field in project link', () => {
  const chain = buildLocalChain(WITH_PARENT);
  assert(chain[0].parent === 'https://github.com/DavidWise01/root0-registry');
});

test('extractGitHubCoords: parses https://github.com URL', () => {
  const c = extractGitHubCoords('https://github.com/DavidWise01/root0-registry');
  assert(c.user === 'DavidWise01');
  assert(c.repo === 'root0-registry');
});

test('extractGitHubCoords: parses bare github.com URL', () => {
  const c = extractGitHubCoords('github.com/DavidWise01/my-repo');
  assert(c.user === 'DavidWise01');
  assert(c.repo === 'my-repo');
});

test('extractGitHubCoords: returns null for non-GitHub URL', () => {
  assert(extractGitHubCoords('https://gitlab.com/foo/bar') === null);
  assert(extractGitHubCoords('not-a-url') === null);
});

test('KNOWN_FRAMEWORKS: STOICHEION sha matches KNOWN_HASHES built-in', () => {
  const fw = KNOWN_FRAMEWORKS['STOICHEION v11.0'];
  assert(fw.sha256 === '02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763');
});

test('parseAttributionResponse: certified when framework = STOICHEION v11.0', () => {
  const body = makeGitHubContentsBody({ ...VALID_ATTR, framework: 'STOICHEION v11.0' });
  const r    = parseAttributionResponse(body);
  assert(r.certified === true, 'should be certified');
  assert(r.framework === 'STOICHEION v11.0');
});

test('parseAttributionResponse: not certified when no framework', () => {
  const body = makeGitHubContentsBody(VALID_ATTR);
  const r    = parseAttributionResponse(body);
  assert(r.certified === false);
  assert(r.framework === null);
});

// ── Lineage badge tests ───────────────────────────────────────────────────

test('lineageAsciiBadge: certified shows CERTIFIED', () => {
  const b = lineageAsciiBadge(true, 'STOICHEION v11.0');
  assert(b.includes('CERTIFIED'));
  assert(b.includes('ROOT0'));
  assert(b.includes('STOICHEION'));
});

test('lineageAsciiBadge: uncertified shows UNVERIFIED', () => {
  const b = lineageAsciiBadge(false);
  assert(b.includes('UNVERIFIED'));
});

test('lineageMarkdownBadge: certified uses mint/green color', () => {
  const md = lineageMarkdownBadge(true, 'STOICHEION v11.0');
  assert(md.includes('86efac'));
  assert(md.includes('stoicheion'));
});

test('lineageMarkdownBadge: uncertified uses amber color', () => {
  const md = lineageMarkdownBadge(false);
  assert(md.includes('fbbf24'));
});

// ── Attribution validator — new lineage fields ────────────────────────────

test('validateAttribution: parent field accepted without error', () => {
  const r = validateAttribution({ ...VALID_ATTR, parent: 'https://github.com/DavidWise01/root0-registry' });
  assert(r.valid === true, `should be valid — ${r.errors.join(', ')}`);
});

test('validateAttribution: sha256 field accepted without error', () => {
  const r = validateAttribution({ ...VALID_ATTR, sha256: '02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763' });
  assert(r.valid === true, `should be valid — ${r.errors.join(', ')}`);
});

test('validateAttribution: bad sha256 raises warning not error', () => {
  const r = validateAttribution({ ...VALID_ATTR, sha256: 'not-a-sha' });
  assert(r.valid === true, 'should still be valid');
  assert(r.warnings.some(w => w.includes('sha256')));
});

test('validateAttribution: empty parent raises warning not error', () => {
  const r = validateAttribution({ ...VALID_ATTR, parent: '' });
  assert(r.valid === true, 'should still be valid');
  assert(r.warnings.some(w => w.includes('parent')));
});

// ── Stamp tests ───────────────────────────────────────────────────────────

test('buildAttribution: produces valid attribution object', () => {
  const obj = buildAttribution('my-repo', DEFAULT_PROFILE);
  const { valid, errors } = validateAttribution(obj);
  assert(valid, `should be valid — ${errors.join(', ')}`);
  assert(obj.project      === 'my-repo');
  assert(obj.framework    === 'STOICHEION v11.0');
  assert(obj.law          === 'Both work. Both fair.');
  assert(obj.contributors.length === 2);
});

test('buildAttribution: human contributor has correct substrate', () => {
  const obj = buildAttribution('test', DEFAULT_PROFILE);
  const human = obj.contributors.find(c => c.substrate === 'human');
  assert(human, 'human contributor missing');
  assert(human.name === 'David Lee Wise');
  assert(human.role === 'architect');
});

test('buildAttribution: ai contributor has provider and model', () => {
  const obj = buildAttribution('test', DEFAULT_PROFILE);
  const ai  = obj.contributors.find(c => c.substrate === 'synthetic');
  assert(ai, 'ai contributor missing');
  assert(ai.provider === 'Anthropic');
  assert(ai.model    === 'Claude Sonnet 4.6');
});

test('buildAttribution: overrides applied', () => {
  const obj = buildAttribution('test', DEFAULT_PROFILE, { project: 'override-name', context: 'research' });
  assert(obj.project === 'override-name');
  assert(obj.context === 'research');
});

test('buildAttribution: no AI when profile.ai is null', () => {
  const profileNoAI = { ...DEFAULT_PROFILE, ai: null };
  const obj = buildAttribution('test', profileNoAI);
  assert(obj.contributors.length === 1, 'should only have human');
  assert(obj.contributors[0].substrate === 'human');
});

test('buildAttribution: date is today (YYYY-MM-DD)', () => {
  const obj = buildAttribution('test', DEFAULT_PROFILE);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(obj.date), `bad date: ${obj.date}`);
});

test('stampDir: writes .attribution file', () => {
  withTempDir(dir => {
    const result = stampDir(dir, DEFAULT_PROFILE);
    assert(result.stamped === true, 'should be stamped');
    assert(fs.existsSync(path.join(dir, '.attribution')), 'file should exist');
    const written = JSON.parse(fs.readFileSync(path.join(dir, '.attribution'), 'utf8'));
    assert(written.project === path.basename(dir));
    assert(written.framework === 'STOICHEION v11.0');
  });
});

test('stampDir: skips if .attribution already exists', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, '.attribution'), '{}', 'utf8');
    const result = stampDir(dir, DEFAULT_PROFILE);
    assert(result.skipped === true);
    assert(result.reason  === 'already exists');
  });
});

test('stampDir: written file passes validateAttribution', () => {
  withTempDir(dir => {
    stampDir(dir, DEFAULT_PROFILE);
    const obj = JSON.parse(fs.readFileSync(path.join(dir, '.attribution'), 'utf8'));
    const { valid, errors } = validateAttribution(obj);
    assert(valid, `should be valid — ${errors.join(', ')}`);
  });
});

test('stampDir: written file is lineage-certified', () => {
  withTempDir(dir => {
    stampDir(dir, DEFAULT_PROFILE);
    const obj   = JSON.parse(fs.readFileSync(path.join(dir, '.attribution'), 'utf8'));
    const chain = buildLocalChain(obj);
    assert(isCertified(chain), 'should be lineage certified');
  });
});

test('stampAll: stamps missing project dirs', () => {
  withTempDir(rootDir => {
    // Create two projects missing .attribution
    const proj1 = path.join(rootDir, 'proj-one');
    const proj2 = path.join(rootDir, 'proj-two');
    fs.mkdirSync(proj1);
    fs.mkdirSync(proj2);
    fs.writeFileSync(path.join(proj1, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj2, 'package.json'), '{}');

    const r = stampAll(rootDir, DEFAULT_PROFILE);
    assert(r.stamped.length === 2, `expected 2 stamped, got ${r.stamped.length}`);
    assert(r.errors.length  === 0, 'should have no errors');
    assert(fs.existsSync(path.join(proj1, '.attribution')));
    assert(fs.existsSync(path.join(proj2, '.attribution')));
  });
});

test('stampAll: dry-run does not write files', () => {
  withTempDir(rootDir => {
    const proj = path.join(rootDir, 'dry-proj');
    fs.mkdirSync(proj);
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');

    const r = stampAll(rootDir, DEFAULT_PROFILE, { dryRun: true });
    assert(r.stamped.length === 1, 'should report 1 would-stamp');
    assert(!fs.existsSync(path.join(proj, '.attribution')), 'should NOT write file in dry-run');
  });
});

test('stampAll: skips repos that already have .attribution', () => {
  withTempDir(rootDir => {
    const proj = path.join(rootDir, 'existing-proj');
    fs.mkdirSync(proj);
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    // Pre-create .attribution
    const obj = buildAttribution(path.basename(proj), DEFAULT_PROFILE);
    fs.writeFileSync(path.join(proj, '.attribution'), JSON.stringify(obj));

    const r = stampAll(rootDir, DEFAULT_PROFILE);
    assert(r.stamped.length === 0, 'nothing to stamp');
    assert(r.skipped.length === 1, 'one already attributed');
  });
});

// ── Summary ───────────────────────────────────────────────────────────────

Promise.all(asyncTests).then(() => {
  console.log();
  console.log('─'.repeat(40));
  if (failed === 0) {
    console.log(`\x1b[92m${passed} tests passed\x1b[0m`);
    process.exit(0);
  } else {
    console.log(`\x1b[91m${failed} failed\x1b[0m  \x1b[92m${passed} passed\x1b[0m`);
    process.exit(1);
  }
});
