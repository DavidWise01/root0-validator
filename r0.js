#!/usr/bin/env node
'use strict';

// ROOT0 Validator CLI — r0
// https://github.com/DavidWise01/root0-validator
//
// Usage:
//   r0 validate <file|dir>       validate .attribution file(s)
//   r0 sha <file> [hash]         compute or verify SHA256
//   r0 ternary                   print ternary spec constants
//   r0 init [dir]                scaffold a new .attribution file
//   r0 scan [dir]                find projects missing .attribution
//   r0 ladder [n]                doubt ladder analysis
//   r0 abd <A> [B] <C>           ABD Law Engine — anchor · witness · law
//   r0 badge [dir]               generate attribution badge for a project
//   r0 register <sha> <name>     register a known hash to ~/.r0-registry.json
//   r0 audit [username]          GitHub attribution coverage report
//   r0 lineage [dir|file]        trace provenance chain → ROOT0 foundation
//   r0 stamp [dir]               non-interactive .attribution stamp from profile
//   r0 stamp --all [root]        batch stamp all missing repos in a tree
//   r0 stamp --setup             create / update ~/.r0-profile.json
//   r0 beacon                    search for your content across GitHub/Kindle/USCO/Reddit/TDCommons
//   r0 beacon --term <term>      add extra search term
//   r0 beacon --platform <name>  search a single platform only
//   r0 beacon --save             save full report to ~/.r0-beacon-report.json
//   r0 whoami                    print ROOT0 framework identity
//   r0 help                      show this help

const fs   = require('fs');
const path = require('path');

const { validateAttribution }                       = require('./lib/attribution');
const { computeSHA256, checkSHA256, KNOWN_HASHES }  = require('./lib/sha');
const { SPEC, stateCount }                          = require('./lib/ternary');
const { runInit }                                   = require('./lib/init');
const { scanDir }                                   = require('./lib/scan');
const { evaluateABD, tritStr }                      = require('./lib/abd');
const { markdownBadge, htmlBadge, asciiBadge, summariseBadge,
        lineageMarkdownBadge, lineageHtmlBadge, lineageAsciiBadge } = require('./lib/badge');
const { registerHash, listRegistry, REGISTRY_PATH } = require('./lib/register');
const { runAudit }                                  = require('./lib/audit');
const { buildChain, buildLocalChain, isCertified, resolveFramework } = require('./lib/lineage');
const { loadProfile, saveProfile, ensureProfile, buildAttribution,
        stampDir, stampAll, pushAll, PROFILE_PATH, DEFAULT_PROFILE } = require('./lib/stamp');
const { runBeacon, checkASINs, REPORT_PATH,
        searchCommonCrawl, searchWayback, probeModels, STOICHEION_PROBES } = require('./lib/beacon');

// ── ANSI colours (graceful fallback if not a TTY) ─────────────────────────
const isTTY = process.stdout.isTTY;
const c = {
  cyan:   s => isTTY ? `\x1b[96m${s}\x1b[0m` : s,
  mint:   s => isTTY ? `\x1b[92m${s}\x1b[0m` : s,
  gold:   s => isTTY ? `\x1b[93m${s}\x1b[0m` : s,
  red:    s => isTTY ? `\x1b[91m${s}\x1b[0m` : s,
  dim:    s => isTTY ? `\x1b[2m${s}\x1b[0m`  : s,
  bold:   s => isTTY ? `\x1b[1m${s}\x1b[0m`  : s,
  violet: s => isTTY ? `\x1b[95m${s}\x1b[0m` : s,
};

const PASS = c.mint('✓');
const FAIL = c.red('✗');
const WARN = c.gold('!');

// ── helpers ───────────────────────────────────────────────────────────────

function header(title) {
  const line = '─'.repeat(56);
  console.log(c.cyan(line));
  console.log(c.bold(c.cyan(`  ${title}`)));
  console.log(c.cyan(line));
}

function rule() {
  console.log(c.dim('─'.repeat(56)));
}

// ── COMMANDS ──────────────────────────────────────────────────────────────

// validate <file|dir>
function cmdValidate(target) {
  if (!target) {
    console.error(c.red('Error: path required — r0 validate <file|dir>'));
    process.exit(2);
  }

  const abs = path.resolve(target);

  if (!fs.existsSync(abs)) {
    console.error(c.red(`Error: not found — ${abs}`));
    process.exit(2);
  }

  const stat = fs.statSync(abs);
  const files = stat.isDirectory()
    ? collectAttributionFiles(abs)
    : [abs];

  if (files.length === 0) {
    console.log(c.gold(`No .attribution files found in ${abs}`));
    process.exit(0);
  }

  let totalPass = 0, totalFail = 0;

  files.forEach(file => {
    validateFile(file);
    const result = validateFile(file, true);
    if (result) totalPass++; else totalFail++;
  });

  if (files.length > 1) {
    rule();
    const summary = totalFail === 0
      ? c.mint(`${totalPass}/${files.length} files valid`)
      : c.red(`${totalFail}/${files.length} files invalid`);
    console.log(`Summary: ${summary}`);
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

function collectAttributionFiles(dir) {
  const results = [];
  const walk = (d) => {
    fs.readdirSync(d).forEach(f => {
      const full = path.join(d, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory() && !f.startsWith('.') && f !== 'node_modules') walk(full);
      else if (f === '.attribution' || f.endsWith('.attribution')) results.push(full);
    });
  };
  walk(dir);
  return results;
}

function validateFile(filePath, quiet = false) {
  if (!quiet) {
    header(`r0 validate  ${path.basename(filePath)}`);
    console.log(c.dim(`  ${filePath}`));
    console.log();
  }

  let obj;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    obj = JSON.parse(raw);
  } catch (e) {
    console.log(`${FAIL}  ${c.red('JSON parse error:')} ${e.message}`);
    if (!quiet) console.log(`\n${c.red('INVALID')} — could not parse JSON\n`);
    return false;
  }

  const { valid, errors, warnings, info } = validateAttribution(obj);

  if (!quiet) {
    info.forEach(line => console.log(`${PASS}  ${c.dim(line)}`));
    warnings.forEach(line => console.log(`${WARN}  ${c.gold(line)}`));
    errors.forEach(line => console.log(`${FAIL}  ${c.red(line)}`));
    console.log();

    if (valid) {
      console.log(c.mint(c.bold(`  ROOT0-ATTRIBUTION-v1.0  VALID ✓`)));
    } else {
      console.log(c.red(c.bold(`  ROOT0-ATTRIBUTION-v1.0  INVALID — ${errors.length} error${errors.length !== 1 ? 's' : ''}`)));
    }
    console.log();
  }

  return valid;
}

// sha <file> [expected]
function cmdSha(filePath, expectedHash) {
  if (!filePath) {
    console.error(c.red('Error: file path required — r0 sha <file> [expected-hash]'));
    process.exit(2);
  }

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error(c.red(`Error: not found — ${abs}`));
    process.exit(2);
  }

  header(`r0 sha  ${path.basename(abs)}`);
  console.log();

  const result = checkSHA256(abs, expectedHash);

  console.log(`${c.dim('File:    ')} ${result.file}`);
  console.log(`${c.dim('SHA256:  ')} ${c.gold(result.actual)}`);

  if (result.known) {
    console.log(`${c.dim('Asset:   ')} ${c.cyan(result.known.name)}`);
    if (result.known.prior_art) console.log(`${c.dim('Prior:   ')} ${result.known.prior_art}`);
    if (result.known.zenodo)    console.log(`${c.dim('Zenodo:  ')} ${result.known.zenodo}`);
    if (result.known.repo)      console.log(`${c.dim('Repo:    ')} ${result.known.repo}`);
  }

  if (result.expected) {
    const match = result.match;
    console.log(`${c.dim('Expected:')} ${result.expected}`);
    console.log();
    if (match) {
      console.log(c.mint(c.bold('  SHA256 MATCH ✓')));
    } else {
      console.log(c.red(c.bold('  SHA256 MISMATCH ✗')));
    }
    process.exit(match ? 0 : 1);
  } else if (result.known) {
    console.log();
    console.log(c.mint(c.bold('  KNOWN ROOT0 ASSET ✓')));
  } else {
    console.log();
    console.log(c.dim('  (no expected hash provided — computed only)'));
  }

  console.log();
}

// ternary
function cmdTernary() {
  header('r0 ternary  ROOT0 Ternary Spec v1.0');
  console.log();

  console.log(c.bold('Trit States'));
  console.log(`  ${c.red('n1')} = -1  ${c.dim('shadow · anchor · boundary')}`);
  console.log(`  ${c.gold('p0')} =  0  ${c.dim('null · witness · doubt · the gap')}`);
  console.log(`  ${c.mint('p1')} = +1  ${c.dim('signal · law · truth · resolved')}`);
  console.log();

  console.log(c.bold('Primitive'));
  console.log(`  ${c.cyan('0 . 0')}  ${c.dim('(left | witness | right — three p0 states)')}`);
  console.log();

  console.log(c.bold('Doubt Ladder'));
  SPEC.ladder.forEach(n => {
    const r = SPEC.rungs[n];
    const states = stateCount(n).toLocaleString().padStart(7);
    console.log(`  Rung ${String(n).padEnd(2)}  ${r.mode.padEnd(14)}  ${c.gold(states)} states  ${c.dim(r.meaning)}`);
  });
  console.log();

  console.log(c.bold('Ground States'));
  console.log(`  ${c.mint('000|1')}  ${c.dim('SAFE — three witnesses through gate → one signal survives')}`);
  console.log(`  ${c.red('00 00')}  ${c.dim('BAD  — no gate, no remainder, signal destroyed')}`);
  console.log();

  console.log(c.bold('Genesis Equation'));
  console.log(`  ${c.cyan('1 = 0 = 1')}  ${c.dim('the system is cyclic — rung 11 is not the end')}`);
  console.log();

  console.log(c.bold('Laws'));
  console.log(`  ${c.dim('"ground doubt to hold truth"')}`);
  console.log(`  ${c.dim('"double to control"')}  ${c.dim('(power-of-2 gates amplitude)')}`);
  console.log(`  ${c.dim('"add witnesses to talk"')}  ${c.dim('(odd ladder enables communication)')}`);
  console.log();

  console.log(c.bold('ABD Mapping'));
  console.log(`  ${c.red('A')} = n1  ${c.dim('Anchor · Containment')}`);
  console.log(`  ${c.gold('B')} = p0  ${c.dim('Witness · Modulation')}`);
  console.log(`  ${c.mint('C')} = p1  ${c.dim('Law · Synthesis')}`);
  console.log();

  console.log(c.bold('42-Universe'));
  console.log(`  ${c.dim('20 p1 (Light) + 20 n1 (Shadow) + 2 p0 (Observers) = 42 = 1')}`);
  console.log();
}

// whoami
function cmdWhoami() {
  header('r0 whoami  ROOT0 / TriPod LLC');
  console.log();
  console.log(`  ${c.cyan('Author')}     David Lee Wise (ROOT0) / TriPod LLC`);
  console.log(`  ${c.cyan('Framework')}  STOICHEION v11.0 · ABD Law Engine`);
  console.log(`  ${c.cyan('SHA256')}     ${c.gold('02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763')}`);
  console.log(`  ${c.cyan('Prior art')}  2026-02-02`);
  console.log(`  ${c.cyan('Zenodo')}     10.5281/zenodo.19122994`);
  console.log(`  ${c.cyan('License')}    CC-BY-ND-4.0 · TRIPOD-IP-v1.1`);
  console.log(`  ${c.cyan('GitHub')}     https://github.com/DavidWise01`);
  console.log(`  ${c.cyan('Index')}      https://davidwise01.github.io`);
  console.log();
  console.log(`  ${c.dim('Registry')}   https://github.com/DavidWise01/root0-registry`);
  console.log(`  ${c.dim('Ternary')}    https://github.com/DavidWise01/ternary-spec`);
  console.log(`  ${c.dim('Attribution')} https://github.com/DavidWise01/attribution-standard`);
  console.log();
  console.log(`  ${c.violet('"The unknown is permanent."')}`);
  console.log();
}

// help
function cmdHelp() {
  header('r0  ROOT0 Validator v1.1');
  console.log();
  console.log(c.bold('Commands'));
  console.log(`  ${c.cyan('r0 validate')}  ${c.dim('<file|dir>')}      validate .attribution file(s)`);
  console.log(`  ${c.cyan('r0 sha')}       ${c.dim('<file> [hash]')}   compute or verify SHA256`);
  console.log(`  ${c.cyan('r0 ternary')}                  print ROOT0 ternary spec constants`);
  console.log(`  ${c.cyan('r0 whoami')}                   print ROOT0 framework identity`);
  console.log(`  ${c.cyan('r0 init')}      ${c.dim('[dir]')}           scaffold a new .attribution file`);
  console.log(`  ${c.cyan('r0 scan')}      ${c.dim('[dir]')}           find projects missing .attribution`);
  console.log(`  ${c.cyan('r0 ladder')}    ${c.dim('[rung]')}          doubt ladder analysis (all or specific rung)`);
  console.log(`  ${c.cyan('r0 abd')}       ${c.dim('<A> [B] <C>')}     ABD Law Engine — anchor · witness · law`);
  console.log(`  ${c.cyan('r0 badge')}     ${c.dim('[dir]')}           generate attribution badge for a project`);
  console.log(`  ${c.cyan('r0 register')}  ${c.dim('<sha> <name>')}    register a known hash to ~/.r0-registry.json`);
  console.log(`  ${c.cyan('r0 audit')}     ${c.dim('[username]')}      GitHub attribution coverage report`);
  console.log(`  ${c.cyan('r0 lineage')}   ${c.dim('[dir] [--follow]')} trace provenance chain → ROOT0 foundation`);
  console.log(`  ${c.cyan('r0 stamp')}     ${c.dim('[dir]')}           stamp .attribution from ~/.r0-profile.json`);
  console.log(`  ${c.cyan('r0 stamp')}     ${c.dim('--all [root]')}    batch stamp all missing repos in a tree`);
  console.log(`  ${c.cyan('r0 stamp')}     ${c.dim('--setup')}         create / update profile (one-time)`);
  console.log(`  ${c.cyan('r0 help')}                     show this help`);
  console.log();
  console.log(c.bold('Examples'));
  console.log(`  ${c.dim('r0 validate .attribution')}`);
  console.log(`  ${c.dim('r0 validate ./my-project')}`);
  console.log(`  ${c.dim('r0 sha stoicheion.pdf 02880745b847...')}`);
  console.log(`  ${c.dim('r0 init')}`);
  console.log(`  ${c.dim('r0 scan "C:/Davids files"')}`);
  console.log(`  ${c.dim('r0 ladder 5')}`);
  console.log(`  ${c.dim('r0 ladder')}`);
  console.log(`  ${c.dim('r0 abd "AI generates code" "Human owns intent"')}`);
  console.log(`  ${c.dim('r0 abd "shadow" "doubt" "law"')}`);
  console.log(`  ${c.dim('r0 badge ./my-project')}`);
  console.log(`  ${c.dim('r0 register 02880745b847... "STOICHEION v12.0"')}`);
  console.log(`  ${c.dim('r0 audit')}`);
  console.log(`  ${c.dim('r0 audit DavidWise01')}`);
  console.log(`  ${c.dim('r0 audit DavidWise01 --token ghp_xxx')}`);
  console.log(`  ${c.dim('r0 audit --json > coverage.json')}`);
  console.log(`  ${c.dim('r0 lineage')}`);
  console.log(`  ${c.dim('r0 lineage ./my-project --follow')}`);
  console.log(`  ${c.dim('r0 stamp --setup')}`);
  console.log(`  ${c.dim('r0 stamp ./my-project')}`);
  console.log(`  ${c.dim('r0 stamp --all "C:/Davids files"')}`);
  console.log(`  ${c.dim('r0 stamp --all "C:/Davids files" --dry-run')}`);
  console.log();
  console.log(c.bold('Exit codes'));
  console.log(`  ${c.mint('0')}  valid / match / covered`);
  console.log(`  ${c.red('1')}  invalid / mismatch / missing`);
  console.log(`  ${c.gold('2')}  usage error`);
  console.log();
  console.log(c.dim('  https://github.com/DavidWise01/root0-validator'));
  console.log();
}

// init [dir]
async function cmdInit(dir) {
  header('r0 init  .attribution scaffold');
  await runInit(dir);
}

// scan [dir]
function cmdScan(target) {
  const abs = path.resolve(target || '.');
  header(`r0 scan  ${abs}`);
  console.log();

  if (!fs.existsSync(abs)) {
    console.error(c.red(`Error: not found — ${abs}`));
    process.exit(2);
  }

  console.log(c.dim('  Scanning for projects...'));
  console.log();

  const results = scanDir(abs);

  if (results.length === 0) {
    console.log(c.gold('  No project directories found.'));
    console.log(c.dim('  Projects are detected by presence of .git, package.json, README.md, index.html, etc.'));
    console.log();
    process.exit(0);
  }

  let covered = 0, missing = 0, invalid = 0;

  results.forEach(r => {
    const name = r.name.padEnd(46);
    if (!r.found) {
      console.log(`${FAIL}  ${name} ${c.dim('no .attribution')}`);
      missing++;
    } else if (!r.valid) {
      console.log(`${WARN}  ${name} ${c.gold('.attribution INVALID')} ${c.dim('— ' + r.errors[0])}`);
      invalid++;
    } else {
      console.log(`${PASS}  ${name} ${c.dim('.attribution valid')}`);
      covered++;
    }
  });

  const total = results.length;
  console.log();
  rule();

  const pct    = Math.round((covered / total) * 100);
  const status = covered === total
    ? c.mint(`${covered}/${total} covered (${pct}%)`)
    : missing > 0
      ? c.red(`${covered}/${total} covered (${pct}%) — ${missing} missing`)
      : c.gold(`${covered}/${total} covered — ${invalid} invalid`);

  console.log(`  Attribution coverage: ${status}`);

  if (missing > 0) {
    console.log(c.dim(`\n  Run r0 init in each missing directory to scaffold .attribution files.`));
  }
  console.log();

  process.exit(covered === total ? 0 : 1);
}

// ladder [n]
function cmdLadder(rungArg) {
  const RUNGS = SPEC.ladder;
  const RUNG_DATA = SPEC.rungs;

  // No arg — print compact summary of all rungs
  if (!rungArg) {
    header('r0 ladder  ROOT0 Doubt Ladder — all rungs');
    console.log();
    console.log(`  ${c.dim('Primitive:')} ${c.cyan('0 . 0')}  ${c.dim('(left | witness | right)')}`);
    console.log(`  ${c.dim('Formula:')}  ${c.cyan('states = 3^n')}  ${c.dim('(odd n only)')}`);
    console.log();

    RUNGS.forEach((n, i) => {
      const r      = RUNG_DATA[n];
      const prev   = i > 0 ? RUNG_DATA[RUNGS[i-1]] : null;
      const states = stateCount(n).toLocaleString().padStart(8);
      const arrow  = i < RUNGS.length - 1 ? c.dim(' →') : c.dim('  ');
      console.log(
        `  ${c.gold('Rung ' + String(n).padEnd(2))}` +
        `  ${c.cyan(r.mode.padEnd(14))}` +
        `  ${c.mint(states)} states` +
        arrow
      );
      console.log(`          ${c.dim(r.meaning)}`);
      if (i < RUNGS.length - 1) console.log();
    });

    console.log();
    console.log(`  ${c.dim('Safe ground:')} ${c.mint('000|1')}  ${c.dim('three witnesses → gate → one signal')}`);
    console.log(`  ${c.dim('Bad collapse:')} ${c.red('00 00')}  ${c.dim('no gate, no remainder')}`);
    console.log(`  ${c.dim('Genesis:')}     ${c.cyan('1 = 0 = 1')}  ${c.dim('rung 11 is not the end — it repeats')}`);
    console.log();
    return;
  }

  // Specific rung
  const n = parseInt(rungArg, 10);
  if (!RUNGS.includes(n)) {
    console.error(c.red(`Error: rung must be one of ${RUNGS.join(', ')}`));
    process.exit(2);
  }

  const r      = RUNG_DATA[n];
  const idx    = RUNGS.indexOf(n);
  const prev   = idx > 0 ? { n: RUNGS[idx-1], ...RUNG_DATA[RUNGS[idx-1]] } : null;
  const next   = idx < RUNGS.length - 1 ? { n: RUNGS[idx+1], ...RUNG_DATA[RUNGS[idx+1]] } : null;
  const states = stateCount(n);

  header(`r0 ladder  Rung ${n} — ${r.mode}`);
  console.log();

  console.log(`  ${c.dim('Rung:    ')} ${c.gold(n)}`);
  console.log(`  ${c.dim('Mode:    ')} ${c.cyan(r.mode)}`);
  console.log(`  ${c.dim('States:  ')} ${c.mint(states.toLocaleString())}  ${c.dim(`(3^${n})`)}`);
  console.log(`  ${c.dim('Meaning: ')} ${r.meaning}`);
  console.log();

  // Progression
  console.log(c.bold('  Progression'));
  RUNGS.forEach(rn => {
    const rd     = RUNG_DATA[rn];
    const sc     = stateCount(rn).toLocaleString().padStart(8);
    const marker = rn === n ? c.mint(' ← you are here') : '';
    const line   = `  ${String(rn).padEnd(3)} ${rd.mode.padEnd(14)} ${sc} states${marker}`;
    console.log(rn === n ? c.mint(line) : c.dim(line));
  });
  console.log();

  // Trit breakdown
  console.log(c.bold('  Trit breakdown'));
  console.log(`  ${n} trit positions × 3 states = 3^${n} = ${states.toLocaleString()} unique configurations`);
  console.log();

  // What happens at this rung
  console.log(c.bold('  At this rung'));
  const meanings = {
    1:  '  The single quantum of doubt. One dot that can choose n1, p0, or p1.\n  This is the seed — the minimal unit of the ternary system.',
    3:  '  The first triword: left | witness | right.\n  Communication becomes possible. 27 distinct messages can be sent.',
    5:  '  Enough witnesses to distinguish signal from noise.\n  Collect all three positions of three triwords. Sort before sending.',
    7:  '  Send scouts to probe ahead while keeping a core safe.\n  The system has enough state space to operate in two modes simultaneously.',
    9:  '  Full 3×3 broadcast plane. Every triword talks to every other.\n  Propagation is now complete — all nodes receive the signal.',
    11: '  Scouts return with data. The loop closes.\n  REPEAT is not termination — it is the cycle completing and beginning again.',
  };
  console.log(meanings[n] || '  (no detail available)');
  console.log();

  // Transitions
  if (prev) {
    const factor = Math.round(states / stateCount(prev.n));
    console.log(c.bold('  From previous rung'));
    console.log(`  Rung ${prev.n} (${prev.mode}) → Rung ${n}: ×${factor} expansion`);
    console.log(`  ${stateCount(prev.n).toLocaleString()} → ${states.toLocaleString()} states`);
    console.log();
  }
  if (next) {
    const factor = Math.round(stateCount(next.n) / states);
    console.log(c.bold('  Next rung'));
    console.log(`  Rung ${n} → Rung ${next.n} (${next.mode}): ×${factor} expansion`);
    console.log(`  ${states.toLocaleString()} → ${stateCount(next.n).toLocaleString()} states`);
    console.log(`  ${c.dim('Add ' + (next.n - n) + ' witness positions to advance.')}`);
    console.log();
  } else {
    console.log(c.dim('  Rung 11 is the final rung. After REPEAT, the cycle returns to Rung 1.'));
    console.log(`  ${c.dim('1 = 0 = 1')}`);
    console.log();
  }
}

// abd <A> [B] <C>
function cmdAbd(rawArgs) {
  // Accept 2 args (A C) or 3 args (A B C)
  if (rawArgs.length < 2) {
    console.error(c.red('Error: r0 abd <A> [B] <C>  — 2 or 3 arguments required'));
    console.error(c.dim('  A = anchor (n1 · -1)  B = witness (p0 · 0, optional)  C = law (p1 · +1)'));
    process.exit(2);
  }

  let labelA, labelB, labelC;
  if (rawArgs.length >= 3) {
    [labelA, labelB, labelC] = rawArgs;
  } else {
    [labelA, labelC] = rawArgs;
    labelB = null;
  }

  const result = evaluateABD(labelA, labelC, labelB);
  const { positions, labels, ops, balanced, groundSafe } = result;

  header('r0 abd  ABD Law Engine');
  console.log();

  // Positions
  console.log(`  ${c.red(   'A')} ${c.dim('anchor  · n1 · -1 ·')} ${c.dim('boundary, constraint, shadow')}`);
  console.log(`     ${c.bold(c.red(`"${labels.A}"`))} `);
  console.log();

  if (labels.B) {
    console.log(`  ${c.gold(  'B')} ${c.dim('witness · p0 ·  0 ·')} ${c.dim('doubt, the gap, the observer')}`);
    console.log(`     ${c.bold(c.gold(`"${labels.B}"`))} `);
  } else {
    console.log(`  ${c.gold(  'B')} ${c.dim('witness · p0 ·  0 ·')} ${c.dim('doubt, the gap, the observer')}`);
    console.log(`     ${c.dim('[unspecified — the space between A and C]')}`);
  }
  console.log();

  console.log(`  ${c.mint(  'C')} ${c.dim('law     · p1 · +1 ·')} ${c.dim('signal, truth, resolution')}`);
  console.log(`     ${c.bold(c.mint(`"${labels.C}"`))} `);
  console.log();

  rule();

  // Operations
  console.log(c.bold('  Operations'));
  console.log(`  ${c.dim('NOT(A)')}  = NOT(-1) = ${c.mint(tritStr(ops.notA))}`);
  console.log(`  ${c.dim('NOT(C)')}  = NOT(+1) = ${c.red( tritStr(ops.notC))}`);
  console.log(`  ${c.dim('AND(A,C)')}= AND(-1,+1) = ${c.red( tritStr(ops.andAC))}  ${c.dim('(anchor dominates)')}`);
  console.log(`  ${c.dim('OR(A,C)')} = OR(-1,+1)  = ${c.mint(tritStr(ops.orAC))}  ${c.dim('(law survives shadow)')}`);
  console.log(`  ${c.dim('AND(A,B)')}= AND(-1, 0) = ${c.red( tritStr(ops.andAB))}  ${c.dim('(shadow absorbs doubt)')}`);
  console.log(`  ${c.dim('OR(B,C)')} = OR( 0,+1)  = ${c.mint(tritStr(ops.orBC))}  ${c.dim('(doubt yields to law)')}`);
  console.log();

  rule();

  // Synthesis
  console.log(c.bold('  Synthesis'));
  if (balanced) {
    console.log(`  ${PASS} NOT(A) = +1 = C  — ${c.mint('the law is the anchor\'s inversion')}`);
    console.log(`  ${PASS} NOT(C) = -1 = A  — ${c.mint('the anchor is the law\'s inversion')}`);
    console.log(`  ${PASS} OR(A,C) = +1      — ${c.mint('law survives when shadow and law meet')}`);
    console.log();
    console.log(`  ${c.mint(c.bold('Ground state: 000|1  SAFE ✓'))}`);
    console.log(`  ${c.dim('"Both work. Both fair."')}`);
  } else {
    console.log(`  ${FAIL} System imbalanced — check A and C positions`);
    console.log(`  ${c.red(c.bold('Ground state: 00 00  UNSAFE'))}`);
  }
  console.log();
}

// badge [dir]
function cmdBadge(target) {
  const dir = path.resolve(target || '.');
  const attrFile = path.join(dir, '.attribution');

  header(`r0 badge  ${path.basename(dir)}`);
  console.log();

  if (!fs.existsSync(attrFile)) {
    console.log(`${FAIL}  ${c.red('No .attribution file found in:')} ${dir}`);
    console.log(c.dim(`  Run: r0 init ${target || ''}`));
    console.log();
    process.exit(1);
  }

  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(attrFile, 'utf8'));
  } catch (e) {
    console.log(`${FAIL}  ${c.red('JSON parse error:')} ${e.message}`);
    process.exit(1);
  }

  const { valid, errors } = validateAttribution(obj);
  const summary = summariseBadge(obj);

  // Status line
  if (valid) {
    console.log(`${PASS}  ${c.mint('.attribution valid')}  ${c.dim('·')}  ${c.cyan(summary.project)}`);
  } else {
    console.log(`${FAIL}  ${c.red('.attribution INVALID')}  ${c.dim('—')}  ${errors[0]}`);
  }
  console.log();

  // Project info
  if (summary.version) console.log(`  ${c.dim('Version:  ')} ${summary.version}`);
  if (summary.context) console.log(`  ${c.dim('Context:  ')} ${summary.context}`);
  if (summary.license) console.log(`  ${c.dim('License:  ')} ${summary.license}`);
  if (summary.date)    console.log(`  ${c.dim('Date:     ')} ${summary.date}`);
  console.log(`  ${c.dim('Law:      ')} ${c.dim(summary.law)}`);
  console.log();

  // Contributors
  console.log(c.bold('  Contributors'));
  summary.contributors.forEach(line => console.log(`  ${c.dim('·')} ${line}`));
  console.log();

  // Lineage check
  const chain      = buildLocalChain(obj);
  const certified  = isCertified(chain);
  const fwName     = obj.framework || null;
  const fwResolved = fwName ? resolveFramework(fwName) : null;

  if (fwName) {
    console.log(c.bold('  Lineage'));
    if (certified) {
      console.log(`  ${PASS} ${c.mint('framework: ' + fwName + ' — SHA verified')}`);
      if (fwResolved) {
        console.log(`  ${c.dim('    SHA256:    ' + fwResolved.sha256.slice(0, 24) + '...')}`);
        console.log(`  ${c.dim('    Prior art: ' + fwResolved.prior_art)}`);
        console.log(`  ${c.dim('    Author:    ' + fwResolved.author)}`);
      }
      console.log(`  ${c.mint(c.bold('    ROOT0 LINEAGE CERTIFIED ✓'))}`);
    } else {
      console.log(`  ${WARN} ${c.gold('framework: ' + fwName + ' — not in known hashes (unverified)')}`);
    }
    console.log();
  }

  rule();

  // Badge outputs
  const md    = markdownBadge(summary.project, valid);
  const html  = htmlBadge(summary.project, valid);
  const ascii = asciiBadge(valid);
  const lMd   = lineageMarkdownBadge(certified, fwName);
  const lHtml = lineageHtmlBadge(certified, fwName);
  const lAscii = lineageAsciiBadge(certified, fwName);

  console.log(c.bold('  Attribution badge'));
  console.log(`  ${valid ? c.mint(ascii) : c.red(ascii)}`);
  console.log(`  ${c.dim(md)}`);
  console.log();

  console.log(c.bold('  Lineage badge'));
  console.log(`  ${certified ? c.mint(lAscii) : c.gold(lAscii)}`);
  console.log(`  ${c.dim(lMd)}`);
  console.log();

  console.log(c.bold('  HTML (both badges)'));
  console.log(`  ${c.dim(html)}`);
  console.log(`  ${c.dim(lHtml)}`);
  console.log();

  console.log(c.dim('  Paste into your README.md or index.html'));
  console.log();
}

// lineage [dir|file] [--token <PAT>] [--follow]
async function cmdLineage(target, rawFlags) {
  const dir  = path.resolve(target || '.');
  const token = process.env.GITHUB_TOKEN
    || (rawFlags.includes('--token') ? rawFlags[rawFlags.indexOf('--token') + 1] : null)
    || (rawFlags.find(f => f.startsWith('--token=')) || '').split('=')[1]
    || null;
  const follow = rawFlags.includes('--follow');

  // Locate .attribution
  let attrPath = dir;
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    attrPath = path.join(dir, '.attribution');
  }

  header(`r0 lineage  ${path.basename(dir)}`);
  console.log();

  if (!fs.existsSync(attrPath)) {
    console.log(`${FAIL}  ${c.red('No .attribution found at:')} ${attrPath}`);
    console.log(c.dim(`  Run: r0 init ${target || ''}`));
    console.log();
    process.exit(1);
  }

  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(attrPath, 'utf8'));
  } catch (e) {
    console.log(`${FAIL}  ${c.red('JSON parse error:')} ${e.message}`);
    process.exit(1);
  }

  // Build the chain
  const chain = follow
    ? await buildChain(obj, { token })
    : buildLocalChain(obj);

  const certified = isCertified(chain);

  // ── Render the tree ──────────────────────────────────────────────────────
  chain.forEach((link, i) => {
    const isLast  = i === chain.length - 1;
    const indent  = '  '.repeat(Math.floor(link.depth || 0));
    const prefix  = link.depth === 0 ? '' : indent + (isLast ? '└── ' : '└── ');

    if (link.type === 'project') {
      const name = c.bold(c.cyan(link.name));
      const fmt  = link.format ? c.dim(` · ${link.format}`) : '';
      console.log(`${prefix}${name}${fmt}`);
      if (link.contributors && link.contributors.length > 0) {
        link.contributors.forEach(co => {
          const role = c.dim(`${co.substrate} · ${co.role}`);
          console.log(`${indent}  ${c.dim('·')} ${co.name}  ${role}`);
        });
      }
      if (link.parent) {
        console.log(`${indent}  ${c.dim('parent →')} ${c.dim(link.parent)}`);
      }

    } else if (link.type === 'parent-link') {
      console.log(`${indent}${c.dim('└── [fetched parent]')} ${c.gold(link.name)}`);

    } else if (link.type === 'framework') {
      const verTag = link.verified
        ? c.mint('SHA verified ✓')
        : c.gold('SHA unverified');
      console.log(`${prefix}${c.gold('framework:')} ${c.bold(link.name)}  ${c.dim('·')}  ${verTag}`);
      if (link.verified) {
        console.log(`${indent}    ${c.dim('SHA256:    ')}${c.gold(link.sha256.slice(0, 24) + '...')}`);
        if (link.prior_art) console.log(`${indent}    ${c.dim('Prior art: ')}${link.prior_art}`);
        if (link.zenodo)    console.log(`${indent}    ${c.dim('Zenodo:    ')}${link.zenodo}`);
        if (link.repo)      console.log(`${indent}    ${c.dim('Repo:      ')}${link.repo}`);
      }

    } else if (link.type === 'foundation') {
      console.log(`${prefix}${c.mint(c.bold(link.name))}`);
      if (link.law)       console.log(`${indent}    ${c.dim('"' + link.law + '"')}`);
      if (link.prior_art) console.log(`${indent}    ${c.dim('Prior art: ')}${link.prior_art}`);
    }

    // Connector line between links
    if (i < chain.length - 1 && link.type !== 'parent-link') {
      const nextDepth = Math.floor(chain[i + 1].depth || 0);
      const connIndent = '  '.repeat(nextDepth);
      console.log(`${connIndent}  ${c.dim('│')}`);
    }
  });

  console.log();
  rule();

  // ── Verdict ──────────────────────────────────────────────────────────────
  if (certified) {
    console.log();
    console.log(c.mint(c.bold('  ROOT0 LINEAGE CERTIFIED ✓')));
    console.log(c.dim('  This project\'s provenance traces to the ROOT0 foundation.'));
    console.log(c.dim('  STOICHEION v11.0 · prior art 2026-02-02 · SHA verified'));
    console.log();
    // Lineage badge suggestion
    const chain0   = chain.find(l => l.type === 'project');
    const fwLink   = chain.find(l => l.type === 'framework');
    const fwName   = fwLink ? fwLink.name : 'STOICHEION v11.0';
    console.log(c.bold('  Add to your README.md:'));
    console.log(`  ${c.dim(lineageMarkdownBadge(true, fwName))}`);
    console.log();
  } else {
    const hasFramework = chain.some(l => l.type === 'framework');
    console.log();
    if (!hasFramework) {
      console.log(c.gold('  LINEAGE UNVERIFIED — no framework field in .attribution'));
      console.log(c.dim('  Add: "framework": "STOICHEION v11.0" to your .attribution file'));
    } else {
      console.log(c.gold('  LINEAGE UNVERIFIED — framework not in known hash registry'));
      console.log(c.dim('  Register the framework SHA with: r0 register <sha> <name>'));
    }
    console.log();
  }

  if (!follow && obj.parent) {
    console.log(c.dim(`  Tip: run with --follow to trace parent chain remotely`));
    console.log(c.dim(`       r0 lineage ${target || '.'} --follow`));
    console.log();
  }

  process.exit(certified ? 0 : 1);
}

// stamp [dir | --all <root> | --setup] [--dry-run] [--context <ctx>]
async function cmdStamp(rawArgs) {
  const allMode   = rawArgs.includes('--all');
  const setupMode = rawArgs.includes('--setup');
  const pushMode  = rawArgs.includes('--push');
  const dryRun    = rawArgs.includes('--dry-run');
  const ctxIdx    = rawArgs.indexOf('--context');
  const ctxOverride = ctxIdx >= 0 ? rawArgs[ctxIdx + 1] : null;

  // Positional arg: dir (single) or root (--all)
  const posArgs = rawArgs.filter(a => !a.startsWith('-'));
  const target  = posArgs[0] || null;

  // ── --setup mode ─────────────────────────────────────────────────────────
  if (setupMode) {
    const readline = require('readline');
    const existing = loadProfile() || DEFAULT_PROFILE;

    header('r0 stamp  profile setup');
    console.log();
    console.log(c.dim(`  Profile will be saved to: ${PROFILE_PATH}`));
    console.log(c.dim('  Press Enter to keep existing values shown in [brackets].'));
    console.log();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q, def) => new Promise(r => rl.question(
      `  ${q} [${def}]: `, a => r(a.trim() || def)
    ));
    const askBool = (q, def = 'y') => new Promise(r => rl.question(
      `  ${q} (y/n) [${def}]: `, a => r((a.trim().toLowerCase() || def) === 'y')
    ));

    const h = existing.human   || {};
    const d = existing.defaults || {};
    const a = existing.ai      || {};

    console.log(c.dim('  ── Human contributor ──────────────────────────────'));
    const name         = await ask('Name',         h.name         || 'David Lee Wise');
    const handle       = await ask('Handle',       h.handle       || 'ROOT0');
    const role         = await ask('Role',         h.role         || 'architect');
    const contribution = await ask('Contribution', h.contribution || 'intent · direction · governance');

    console.log();
    console.log(c.dim('  ── Defaults ────────────────────────────────────────'));
    const license   = await ask('License',   d.license   || 'CC-BY-ND-4.0');
    const framework = await ask('Framework', d.framework || 'STOICHEION v11.0');
    const context   = await ask('Context',   d.context   || 'code');

    console.log();
    const includeAI = await askBool('Include AI contributor by default?', 'y');
    let aiConfig = null;
    if (includeAI) {
      console.log(c.dim('  ── AI contributor ──────────────────────────────────'));
      const aiName     = await ask('Name',     a.name     || 'AVAN');
      const aiProvider = await ask('Provider', a.provider || 'Anthropic');
      const aiModel    = await ask('Model',    a.model    || 'Claude Sonnet 4.6');
      const aiRole     = await ask('Role',     a.role     || 'co-author');
      const aiContrib  = await ask('Contribution', a.contribution || 'intellect · generation · execution');
      aiConfig = { name: aiName, substrate: 'synthetic', provider: aiProvider, model: aiModel, role: aiRole, contribution: aiContrib };
    }

    rl.close();

    const profile = {
      human:    { name, handle, substrate: 'human', role, contribution },
      ai:       aiConfig,
      defaults: { license, framework, law: 'Both work. Both fair.', context, version: d.version || 'v1.0' },
    };

    saveProfile(profile);

    console.log();
    console.log(c.mint(`  ✓  Profile saved to ${PROFILE_PATH}`));
    console.log();
    console.log(c.dim('  Now run:'));
    console.log(c.dim('    r0 stamp ./my-project          — stamp one repo'));
    console.log(c.dim('    r0 stamp --all "C:/my-root"    — stamp all missing repos'));
    console.log();
    return;
  }

  // ── Load profile ─────────────────────────────────────────────────────────
  const profile = ensureProfile();
  const overrides = ctxOverride ? { context: ctxOverride } : {};

  // ── --all mode — batch stamp entire tree ─────────────────────────────────
  if (allMode) {
    const root = path.resolve(target || '.');
    header(`r0 stamp --all  ${root}`);
    console.log();

    if (!fs.existsSync(root)) {
      console.error(c.red(`Error: not found — ${root}`));
      process.exit(2);
    }

    if (dryRun) console.log(c.gold('  DRY RUN — no files will be written\n'));
    console.log(c.dim('  Scanning for projects...'));
    console.log();

    const { stamped, skipped, errors, total } = stampAll(root, profile, { dryRun, overrides });

    stamped.forEach(r => {
      const name = r.name.padEnd(46);
      const tag  = dryRun ? c.gold('[would stamp]') : c.mint('[stamped]');
      console.log(`${PASS}  ${name} ${tag}`);
    });
    skipped.forEach(r => {
      if (r.reason === 'already has .attribution') {
        console.log(`${c.dim('·')}   ${r.name.padEnd(46)} ${c.dim('[already attributed]')}`);
      }
      // silently skip other skip reasons in batch mode
    });
    errors.forEach(r => {
      console.log(`${FAIL}  ${r.name.padEnd(46)} ${c.red('[error]')} ${c.dim(r.error)}`);
    });

    console.log();
    rule();

    const already = skipped.filter(s => s.reason === 'already has .attribution').length;
    console.log(`  Stamped:  ${c.mint(String(stamped.length))}`);
    console.log(`  Already:  ${c.dim(String(already))}`);
    if (errors.length) console.log(`  Errors:   ${c.red(String(errors.length))}`);
    console.log(`  Total:    ${total} projects`);
    console.log();

    if (stamped.length > 0 && !dryRun) {
      console.log(c.dim('  Next: run r0 audit to confirm coverage, then commit the .attribution files.'));
      console.log(c.dim(`  Tip:  git add \`**/.attribution\` && git commit -m "chore: add .attribution files"`));
    }
    if (dryRun && stamped.length > 0) {
      console.log(c.gold(`  Run without --dry-run to write ${stamped.length} file${stamped.length !== 1 ? 's' : ''}.`));
    }
    console.log();

    process.exit(errors.length > 0 ? 1 : 0);
    return;
  }

  // ── --push mode — commit + push .attribution for all git repos in tree ───
  if (pushMode) {
    const root = path.resolve(target || '.');
    header(`r0 stamp --push  ${root}`);
    console.log();
    console.log(c.dim('  Scanning for git repos with .attribution to push...'));
    console.log();

    const { pushed, skipped } = pushAll(root);

    pushed.forEach(r => {
      console.log(`${PASS}  ${r.name.padEnd(46)} ${c.mint(`[pushed → ${r.branch}]`)}`);
    });
    skipped.forEach(r => {
      const reason = r.reason;
      if (reason === 'not a git repo' || reason === 'no remote') return; // silent
      if (reason === 'nothing to commit (already pushed)') {
        console.log(`${c.dim('·')}   ${r.name.padEnd(46)} ${c.dim('[already pushed]')}`);
      } else {
        console.log(`${WARN}  ${r.name.padEnd(46)} ${c.gold('[skipped]')} ${c.dim(reason)}`);
      }
    });

    console.log();
    rule();
    console.log(`  Pushed:  ${c.mint(String(pushed.length))}`);
    const alreadyDone = skipped.filter(s => s.reason === 'nothing to commit (already pushed)').length;
    if (alreadyDone) console.log(`  Already: ${c.dim(String(alreadyDone))}`);
    const warned = skipped.filter(s => s.reason !== 'not a git repo' && s.reason !== 'no remote' && s.reason !== 'nothing to commit (already pushed)').length;
    if (warned) console.log(`  Skipped: ${c.gold(String(warned))}`);
    console.log();

    if (pushed.length > 0) {
      console.log(c.dim('  Next: r0 audit DavidWise01 — watch the scoreboard'));
    }
    console.log();
    process.exit(0);
    return;
  }

  // ── Single dir mode ───────────────────────────────────────────────────────
  const dir = path.resolve(target || '.');
  const projectName = path.basename(dir);

  header(`r0 stamp  ${projectName}`);
  console.log();

  if (!fs.existsSync(dir)) {
    console.error(c.red(`Error: not found — ${dir}`));
    process.exit(2);
  }

  const result = stampDir(dir, profile, overrides);

  if (result.skipped) {
    console.log(`${WARN}  ${c.gold('Skipped:')} ${result.reason}`);
    console.log(c.dim(`  ${result.path}`));
    if (result.reason === 'already exists') {
      console.log(c.dim('  Run r0 validate to check it, or r0 lineage to trace its chain.'));
    }
    console.log();
    process.exit(0);
  }

  console.log(`${PASS}  ${c.mint('.attribution written')}`);
  console.log(c.dim(`  ${result.path}`));
  console.log();
  console.log(c.dim(JSON.stringify(result.obj, null, 2)));
  console.log();

  // Quick lineage check
  const { buildLocalChain, isCertified } = require('./lib/lineage');
  const chain = buildLocalChain(result.obj);
  if (isCertified(chain)) {
    console.log(c.mint('  ROOT0 LINEAGE CERTIFIED ✓'));
    console.log(c.dim('  framework: ' + (result.obj.framework || '') + ' — SHA verified'));
  }
  console.log();
  console.log(c.dim(`  Next: r0 validate ${dir}`));
  console.log(c.dim(`        r0 lineage  ${dir}`));
  console.log(c.dim(`        r0 badge    ${dir}`));
  console.log();
}

// audit [username] [--token <PAT>] [--json] [--include-forks] [--include-archived]
async function cmdAudit(rawArgs) {
  // Parse flags out of args
  let username        = null;
  let token           = process.env.GITHUB_TOKEN || null;
  let jsonMode        = false;
  let includeForks    = false;
  let includeArchived = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--json')              { jsonMode        = true; }
    else if (a === '--forks')        { includeForks    = true; }
    else if (a === '--archived')     { includeArchived = true; }
    else if (a === '--token')        { token = rawArgs[++i]; }
    else if (a.startsWith('--token=')) { token = a.split('=')[1]; }
    else if (!a.startsWith('-'))     { username = a; }
  }

  username = username || 'DavidWise01';

  if (!jsonMode) {
    header(`r0 audit  ${username}`);
    console.log();
    if (token) {
      console.log(c.dim('  Authenticated — using token (5000 req/hr limit)'));
    } else {
      console.log(c.dim('  Unauthenticated — 60 req/hr limit. Set GITHUB_TOKEN or pass --token <PAT> for more.'));
    }
    console.log(c.dim('  Fetching repos...'));
    console.log();
  }

  let audit;
  try {
    audit = await runAudit(username, token);
  } catch (e) {
    if (jsonMode) {
      console.log(JSON.stringify({ error: e.message }));
    } else {
      console.error(`${FAIL}  ${c.red(e.message)}`);
    }
    process.exit(2);
  }

  // Filter forks / archived if not requested
  let results = audit.results;
  if (!includeForks)    results = results.filter(r => !r.fork);
  if (!includeArchived) results = results.filter(r => !r.archived);

  const covered   = results.filter(r => r.found && r.valid).length;
  const invalid   = results.filter(r => r.found && !r.valid).length;
  const missing   = results.filter(r => !r.found).length;
  const total     = results.length;
  const pct       = total > 0 ? Math.round((covered / total) * 100) : 0;
  const certified = results.filter(r => r.found && r.valid && r.certified).length;

  // ── JSON output ──────────────────────────────────────────────────────────
  if (jsonMode) {
    console.log(JSON.stringify({ username, total, covered, invalid, missing, pct, results }, null, 2));
    process.exit(covered === total ? 0 : 1);
    return;
  }

  // ── Terminal output ──────────────────────────────────────────────────────
  if (total === 0) {
    console.log(c.gold(`  No repos found for ${username}`));
    console.log();
    process.exit(0);
  }

  // Sort: valid first, then invalid, then missing
  const sorted = [
    ...results.filter(r => r.found && r.valid),
    ...results.filter(r => r.found && !r.valid),
    ...results.filter(r => !r.found),
  ];

  sorted.forEach(r => {
    const name = r.repo.padEnd(44);
    if (r.error && !r.found) {
      console.log(`${WARN}  ${name} ${c.gold('API error')} ${c.dim('— ' + r.error)}`);
    } else if (!r.found) {
      console.log(`${FAIL}  ${name} ${c.dim('no .attribution')}`);
    } else if (!r.valid) {
      const errSnip = (r.errors || [])[0] || 'invalid';
      console.log(`${WARN}  ${name} ${c.gold('.attribution INVALID')} ${c.dim('— ' + errSnip)}`);
    } else {
      const lineageTag = r.certified
        ? c.mint(' [ROOT0 ✓]')
        : r.framework
          ? c.gold(` [${r.framework} — unverified]`)
          : c.dim(' [no lineage]');
      console.log(`${PASS}  ${name} ${c.dim('.attribution valid')}${lineageTag}`);
    }
  });

  console.log();
  rule();

  // Summary line
  const pctStr = `${pct}%`;
  const summaryColor = covered === total ? c.mint : (missing > 0 ? c.red : c.gold);
  const summaryText  = covered === total
    ? `${covered}/${total} covered (${pctStr})  ✓`
    : missing > 0
      ? `${covered}/${total} covered (${pctStr}) — ${missing} missing, ${invalid} invalid`
      : `${covered}/${total} covered (${pctStr}) — ${invalid} invalid`;

  console.log(`  Attribution coverage: ${summaryColor(summaryText)}`);

  // Lineage tally (only show if any repos are covered)
  if (covered > 0) {
    const certColor = certified === covered ? c.mint : c.gold;
    console.log(`  ROOT0 Lineage certified: ${certColor(`${certified}/${covered} attributed repos`)}`);
  }

  // Rate limit info
  if (audit.rateInfo) {
    const { remaining, resetDate } = audit.rateInfo;
    const resetStr = resetDate ? `  resets ${resetDate.replace('T', ' ').slice(0,19)} UTC` : '';
    console.log(c.dim(`  GitHub API: ${remaining} requests remaining${resetStr}`));
  }

  // Skipped info
  const skippedForks    = audit.results.filter(r => r.fork).length;
  const skippedArchived = audit.results.filter(r => r.archived && !r.fork).length;
  if (skippedForks > 0 || skippedArchived > 0) {
    const parts = [];
    if (skippedForks    > 0) parts.push(`${skippedForks} fork${skippedForks !== 1 ? 's' : ''}`);
    if (skippedArchived > 0) parts.push(`${skippedArchived} archived`);
    console.log(c.dim(`  Skipped: ${parts.join(', ')} (use --forks --archived to include)`));
  }

  if (missing > 0) {
    console.log();
    if (covered === 0) {
      // First-time user — give the full onboarding sequence
      console.log(c.bold('  Next steps:'));
      console.log(c.dim('  1.  r0 stamp --setup'));
      console.log(c.dim(`       Create your ~/.r0-profile.json (one-time, 60 seconds)`));
      console.log(c.dim('  2.  r0 stamp --all <local-root> --dry-run'));
      console.log(c.dim(`       Preview what would be stamped`));
      console.log(c.dim('  3.  r0 stamp --all <local-root>'));
      console.log(c.dim(`       Write .attribution to all ${missing} missing repos`));
      console.log(c.dim('  4.  r0 audit ' + username));
      console.log(c.dim(`       Confirm coverage (target: ${total}/${total})`));
    } else {
      console.log(c.dim(`  Run r0 stamp <dir> to stamp missing repos, or r0 stamp --all <root> for batch.`));
      console.log(c.dim(`  Run r0 badge <dir> after to generate README badges.`));
    }
  }
  console.log();

  process.exit(covered === total ? 0 : 1);
}

// register <sha> <name> [notes...]
function cmdRegister(sha, name, ...notes) {
  if (!sha || !name) {
    console.error(c.red('Error: r0 register <sha256> <name> [notes]'));
    console.error(c.dim('  sha256 — 64-character hex string'));
    console.error(c.dim('  name   — human-readable asset name (e.g. "STOICHEION v12.0")'));
    process.exit(2);
  }

  header('r0 register  user hash registry');
  console.log();

  let result;
  try {
    result = registerHash(sha, name, { notes: notes.join(' ') || undefined });
  } catch (e) {
    console.error(`${FAIL}  ${c.red(e.message)}`);
    process.exit(1);
  }

  const verb = result.isUpdate ? 'Updated' : 'Registered';
  console.log(`${PASS}  ${c.mint(verb + ':')} ${c.cyan(result.entry.name)}`);
  console.log();
  console.log(`  ${c.dim('SHA256:    ')} ${c.gold(result.hash)}`);
  console.log(`  ${c.dim('Name:      ')} ${result.entry.name}`);
  console.log(`  ${c.dim('Registered:')} ${result.entry.registered}`);
  if (result.entry.notes) console.log(`  ${c.dim('Notes:     ')} ${result.entry.notes}`);
  console.log(`  ${c.dim('Registry:  ')} ${result.registryPath}`);
  console.log();

  // Show full registry count
  const reg  = listRegistry();
  const count = Object.keys(reg).length;
  console.log(c.dim(`  User registry now contains ${count} hash${count !== 1 ? 'es' : ''}.`));
  console.log(c.dim('  Run r0 sha <file> to identify registered assets.'));
  console.log();
}

// ── beacon ────────────────────────────────────────────────────────────────

async function cmdBeacon(rawArgs) {
  const jsonMode   = rawArgs.includes('--json');
  const saveMode   = rawArgs.includes('--save');
  const platFlag   = rawArgs.indexOf('--platform');
  const termFlags  = [];
  const redditFlag = rawArgs.indexOf('--reddit');
  const tokenFlag  = rawArgs.indexOf('--token');

  // Probe flags — model behavioral fingerprinting
  const probeTypeFlag     = rawArgs.indexOf('--probe-type');     // anthropic|openai|generic
  const probeKeyFlag      = rawArgs.indexOf('--probe-key');      // API key
  const probeModelFlag    = rawArgs.indexOf('--probe-model');    // model id
  const probeEndptFlag    = rawArgs.indexOf('--probe-endpoint'); // for generic

  // Collect --term values
  rawArgs.forEach((a, i) => {
    if (a === '--term' && rawArgs[i + 1]) termFlags.push(rawArgs[i + 1]);
  });

  const singlePlatform = platFlag >= 0 ? rawArgs[platFlag + 1] : null;
  const platforms = singlePlatform
    ? [singlePlatform]
    : ['github', 'kindle', 'usco', 'reddit', 'tdcommons',
       'commoncrawl', 'wayback', 'probe'];

  const redditUser = redditFlag >= 0 ? rawArgs[redditFlag + 1] : null;
  const token      = tokenFlag  >= 0 ? rawArgs[tokenFlag  + 1] : process.env.GITHUB_TOKEN;

  // Build probe API config from flags / env
  const probeApis = [];
  const probeType = probeTypeFlag >= 0
    ? rawArgs[probeTypeFlag + 1]
    : (process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : null);
  const probeKey  = probeKeyFlag >= 0
    ? rawArgs[probeKeyFlag + 1]
    : (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || null);
  const probeModel = probeModelFlag >= 0 ? rawArgs[probeModelFlag + 1] : null;
  const probeEndpt = probeEndptFlag >= 0 ? rawArgs[probeEndptFlag + 1] : null;

  if (probeType && probeKey) {
    probeApis.push({
      type:     probeType,
      key:      probeKey,
      model:    probeModel || (probeType === 'anthropic' ? 'claude-opus-4-5' : 'gpt-4o'),
      endpoint: probeEndpt,
    });
  }

  // Load profile for default terms
  const profile = loadProfile();
  const profileTerms = [];

  if (profile?.beacon?.terms?.length) {
    profileTerms.push(...profile.beacon.terms);
  } else {
    if (profile?.human?.name)   profileTerms.push(profile.human.name);
    if (profile?.human?.handle) profileTerms.push(profile.human.handle);
    if (profile?.defaults?.framework) {
      const fw = profile.defaults.framework.split(' ')[0];
      if (fw) profileTerms.push(fw);
    }
  }

  const redditFromProfile = profile?.beacon?.reddit_user || profile?.human?.handle?.toLowerCase();

  const terms = [...new Set([...profileTerms, ...termFlags])].filter(Boolean);
  if (terms.length === 0) terms.push('ROOT0', 'STOICHEION', 'David Lee Wise');

  // Build crawl URL patterns from profile (for CC + Wayback)
  // github_user is the actual GitHub username (DavidWise01), distinct from the brand handle (ROOT0)
  const ownUser    = profile?.human?.handle || 'ROOT0';
  const githubUser = profile?.human?.github_user || profile?.human?.handle || 'DavidWise01';
  const crawlUrls = [
    `github.com/${githubUser}/*`,
    `raw.githubusercontent.com/${githubUser}/*`,
  ];
  if (profile?.beacon?.td_commons_url) {
    try {
      const host = new URL(profile.beacon.td_commons_url).hostname;
      crawlUrls.push(`${host}/*`);
      // Also add known STOICHEION submission page directly (via DOI redirect)
      const stoicheionWork = (profile?.beacon?.known_works || []).find(w => w.doi);
      if (stoicheionWork?.doi) {
        // DOI resolves through doi.org to TD Commons — check both
        const doiPath = stoicheionWork.doi.replace('10.5281/zenodo.', '');
        crawlUrls.push(`doi.org/${stoicheionWork.doi}`);
        crawlUrls.push(`zenodo.org/records/${doiPath}`);
      }
    } catch {}
  }
  // Reddit profile — use exact URL (no /* wildcard) so matchType=exact avoids false positives
  // from other users whose names start with ROOT0
  if (profile?.beacon?.reddit_user) {
    const ru = profile.beacon.reddit_user;
    crawlUrls.push(`www.reddit.com/user/${ru}`);
    crawlUrls.push(`www.reddit.com/user/${ru}/`);
    crawlUrls.push(`www.reddit.com/user/${ru}/submitted`);
  }
  // Amazon author page
  crawlUrls.push('amazon.com/David-Wise/e/B0H2T5M1T5');
  // Amazon book pages — add all books that may predate the training cutoff.
  // Heuristic: ASINs starting with B0D*, B0F*, B0G* were published before B0H* (2026-05+).
  // Also include books with explicit prior_art dates.
  const CUTOFF = '2026-02-05';
  const allWorks = (profile?.beacon?.known_works || []).filter(w => w.asin);
  const preCutoffWorks = allWorks.filter(w =>
    (w.prior_art && w.prior_art <= CUTOFF) ||
    /^B0[DF]/.test(w.asin) ||   // B0D* and B0F* ASINs are definitively older
    (w.asin.startsWith('B0G') && !w.asin.startsWith('B0GN') && !w.asin.startsWith('B0GV') && !w.asin.startsWith('B0GW'))
  );
  const works = preCutoffWorks.length > 0 ? preCutoffWorks : allWorks.slice(0, 8);
  works.forEach(w => crawlUrls.push(`amazon.com/dp/${w.asin}`));

  if (!jsonMode) {
    header('r0 beacon');
    console.log();
    console.log(c.dim('  Search terms: ') + terms.map(t => c.gold(t)).join(c.dim(', ')));
    console.log(c.dim('  Platforms:    ') + platforms.map(p => c.cyan(p)).join(c.dim(', ')));
    if (probeApis.length) {
      console.log(c.dim('  Probe model:  ') + c.gold(`${probeApis[0].type}/${probeApis[0].model}`));
    }
    console.log();
    console.log(c.dim('  Scanning the web for your content...\n'));
  }

  const PLATFORM_LABELS = {
    github:      'GitHub',
    kindle:      'Kindle',
    usco:        'USCO',
    reddit:      'Reddit',
    tdcommons:   'TD Commons',
    commoncrawl: 'Common Crawl',
    wayback:     'Wayback Machine',
    probe:       'Model Probe',
  };

  const TYPE_ICONS = {
    repo:             '⬡',
    code:             '◈',
    ebook:            '◉',
    'asin-check':     '◉',
    copyright:        '©',
    post:             '▲',
    'own-post':       '▲',
    comment:          '◆',
    document:         '◉',
    'crawl-record':   '⬡',
    'archive-capture':'⬡',
    'model-probe':    '◈',
  };

  // Run ASIN direct checks first (from known_works in profile)
  const knownWorks  = profile?.beacon?.known_works || [];
  const asinResults = knownWorks.length > 0 ? await checkASINs(knownWorks) : [];

  const report = await runBeacon({
    terms,
    token,
    ownUser: githubUser,
    redditUser:   redditUser || redditFromProfile,
    tdCommonsUrl: profile?.beacon?.td_commons_url || 'https://tdcommons.org',
    platforms,
    crawlUrls,
    cutoffDate:   '20260205',
    waybackFrom:  '20240101',
    probeApis,
    onProgress: name => {
      if (!jsonMode) process.stdout.write(c.dim(`  → scanning ${PLATFORM_LABELS[name] || name}...\n`));
    },
  });

  if (jsonMode) {
    console.log(JSON.stringify({ asinResults, ...report }, null, 2));
    process.exit(0);
    return;
  }

  console.log();

  let totalHits = 0;

  // ── Known works / ASIN status ────────────────────────────────────────────
  if (asinResults.length > 0) {
    rule();
    console.log(`  ${c.cyan(c.bold('Known Works'.padEnd(14)))} ${c.dim('direct ASIN check')}`);
    console.log();
    asinResults.forEach(h => {
      const status  = h.live === true  ? c.mint('[LIVE ✓]')
                    : h.live === false ? c.red('[DOWN ✗]')
                    : c.dim('[unknown]');
      const price   = h.price ? c.dim(` ${h.price}`) : '';
      const asinStr = c.dim(` ASIN:${h.asin}`);
      console.log(`  ${c.mint('◉')}  ${h.title.slice(0, 65)}${price}  ${status}${asinStr}`);
      console.log(`     ${c.dim(h.url)}`);
    });
    console.log();
  }

  for (const plat of platforms) {
    const hits  = report.byPlatform[plat] || [];
    const label = PLATFORM_LABELS[plat] || plat;
    rule();

    // ── Common Crawl display ─────────────────────────────────────────────
    if (plat === 'commoncrawl') {
      console.log(`  ${c.cyan(c.bold(label.padEnd(14)))} ${c.dim(`${hits.length} crawl record${hits.length !== 1 ? 's' : ''} before 2026-02-05`)}`);
      console.log();
      if (hits.length === 0) {
        console.log(c.dim('  · No records found in CC index for scanned URLs'));
        console.log(c.dim('  · GitHub and Amazon block Common Crawl via robots.txt'));
        console.log(c.dim('  · Zero CC hits = only purpose-built API scrapers could have ingested this content'));
        console.log(c.dim('    (GitHub API + KDP data pipeline — not a public crawl)'));
      } else {
        hits.forEach(h => {
          const crawl  = c.dim(` [${h.crawlIndex}]`);
          const date   = h.date ? c.mint(` crawled:${h.date}`) : '';
          const status = h.status === '200' ? c.mint(' ✓') : c.dim(` HTTP:${h.status}`);
          console.log(`  ${c.gold('⬡')}  ${(h.title || h.url).slice(0, 70)}${status}${date}${crawl}`);
        });
        console.log();
        console.log(c.red(`  ⚠  ${hits.length} record(s) confirm public CC indexing before Opus 4.6 training cutoff`));
        console.log(c.red('     → Content was in the open web crawl — direct training data exposure'));
      }
      totalHits += hits.length;
      console.log();
      continue;
    }

    // ── Wayback Machine display ──────────────────────────────────────────
    if (plat === 'wayback') {
      console.log(`  ${c.cyan(c.bold(label.padEnd(14)))} ${c.dim(`${hits.length} archive capture${hits.length !== 1 ? 's' : ''} (2024-01-01 → 2026-02-05)`)}`);
      console.log();
      if (hits.length === 0) {
        console.log(c.dim('  · No Wayback captures found in the target date window'));
      } else {
        // Group by original URL, show earliest + latest
        const byUrl = {};
        hits.forEach(h => {
          if (!byUrl[h.original]) byUrl[h.original] = [];
          byUrl[h.original].push(h.date);
        });
        const TRAINING_CUTOFF = '2026-02-05';
        let precountWB = 0;
        Object.entries(byUrl).forEach(([url, dates]) => {
          dates.sort();
          const firstDate  = dates[0];
          const earliest   = c.mint(firstDate);
          const count      = c.dim(` (${dates.length} capture${dates.length !== 1 ? 's' : ''})`);
          const preTraining = firstDate <= TRAINING_CUTOFF;
          if (preTraining) precountWB++;
          const tag = preTraining
            ? c.red(' ◀ BEFORE TRAINING CUTOFF')
            : c.dim(' (post-cutoff)');
          console.log(`  ${c.gold('⬡')}  ${url.slice(0, 70)}`);
          console.log(`     ${c.dim('First captured:')} ${earliest}${count}${tag}`);
        });
        console.log();
        if (precountWB > 0) {
          console.log(c.red(`  ⚠  ${precountWB} URL(s) publicly accessible BEFORE 2026-02-05 training cutoff`));
          console.log(c.red(`     → Wayback confirms content was scrapable during training window`));
        } else {
          console.log(c.gold(`  ⚠  Content was publicly accessible — Wayback confirms scraping window`));
        }
      }
      totalHits += hits.length;
      console.log();
      continue;
    }

    // ── Model Probe display ──────────────────────────────────────────────
    if (plat === 'probe') {
      if (hits.length === 0) {
        console.log(`  ${c.cyan(c.bold(label.padEnd(14)))} ${c.dim('no API configured')}`);
        console.log();
        console.log(c.dim('  To enable: r0 beacon --probe-type openai --probe-key <key>'));
        console.log(c.dim('             r0 beacon --probe-type anthropic --probe-key <key>'));
        console.log(c.dim('  Or set OPENAI_API_KEY / ANTHROPIC_API_KEY in environment'));
        console.log();
        continue;
      }
      const familiar = hits.filter(h => h.familiar).length;
      const total    = hits.length;
      const verdict  = familiar >= 3
        ? c.red(`FAMILIAR (${familiar}/${total} probes matched) ⚠  TRAINING DATA EXPOSURE LIKELY`)
        : familiar >= 1
        ? c.gold(`PARTIAL (${familiar}/${total} probes matched) — investigate`)
        : c.mint(`UNKNOWN (${familiar}/${total}) — no exposure detected`);

      console.log(`  ${c.cyan(c.bold(label.padEnd(14)))} ${verdict}`);
      console.log();

      hits.forEach(h => {
        const scoreBar = h.maxScore > 0
          ? `${h.score}/${h.maxScore}`
          : '0/0';
        const famFlag  = h.familiar ? c.red(' [FAMILIAR]') : c.dim(' [unknown]');
        const matched  = h.keywordsMatched?.length
          ? c.dim(`   matched: ${h.keywordsMatched.join(', ')}`)
          : '';
        const missed   = h.keywordsMissed?.length
          ? c.dim(`   missed:  ${h.keywordsMissed.join(', ')}`)
          : '';
        console.log(`  ${c.gold('◈')}  [${h.model}] ${h.probeId} — ${scoreBar} keywords${famFlag}`);
        if (matched) console.log(`     ${matched}`);
        if (missed)  console.log(`     ${missed}`);
        if (h.error)  console.log(`     ${c.red(`error: ${h.error}`)}`);
      });
      totalHits += familiar;
      console.log();
      continue;
    }

    // ── Standard platform display ────────────────────────────────────────
    console.log(`  ${c.cyan(c.bold(label.padEnd(14)))} ${c.dim(`${hits.length} hit${hits.length !== 1 ? 's' : ''}`)}`);
    console.log();

    if (hits.length === 0) {
      console.log(c.dim('  · No results found'));
    } else {
      hits.forEach(h => {
        const icon  = TYPE_ICONS[h.type] || '·';
        const date  = h.date ? c.dim(` [${h.date}]`) : '';
        const score = h.score != null ? c.dim(` ↑${h.score}`) : '';
        const sub   = h.subreddit ? c.dim(` ${h.subreddit}`) : '';
        const stars = h.stars != null ? c.dim(` ★${h.stars}`) : '';
        const reg   = h.regNumber ? c.gold(` [${h.regNumber}]`) : '';
        const own   = h.own === false ? c.gold(' [external]') : '';
        const term  = c.dim(` «${h.term}»`);
        console.log(`  ${c.mint(icon)}  ${h.title.slice(0, 70)}${own}${reg}${stars}${score}${sub}${date}${term}`);
        if (h.url) console.log(`     ${c.dim(h.url.slice(0, 90))}`);
      });
      totalHits += hits.length;
    }
    console.log();
  }

  rule();
  console.log(`  Total hits: ${c.mint(String(totalHits))} across ${c.cyan(String(platforms.length))} platforms`);
  console.log(`  Terms searched: ${terms.map(t => c.gold(t)).join(', ')}`);
  console.log();

  if (saveMode) {
    const outPath = REPORT_PATH;
    fs.writeFileSync(outPath, JSON.stringify({ asinResults, ...report }, null, 2) + '\n', 'utf8');
    console.log(c.dim(`  Report saved → ${outPath}`));
    console.log();
  }

  if (!saveMode && totalHits > 0) {
    console.log(c.dim('  Tip: run r0 beacon --save to persist this report'));
    console.log();
  }

  process.exit(0);
}

// ── MAIN ──────────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'validate':  cmdValidate(args[0]);                      break;
  case 'sha':       cmdSha(args[0], args[1]);                  break;
  case 'ternary':   cmdTernary();                              break;
  case 'whoami':    cmdWhoami();                               break;
  case 'init':      cmdInit(args[0]);                          break;
  case 'scan':      cmdScan(args[0]);                          break;
  case 'ladder':    cmdLadder(args[0]);                        break;
  case 'abd':       cmdAbd(args);                              break;
  case 'badge':     cmdBadge(args[0]);                         break;
  case 'register':  cmdRegister(args[0], args[1], ...args.slice(2)); break;
  case 'audit':     cmdAudit(args);                            break;
  case 'lineage':   cmdLineage(args[0], args.slice(1));        break;
  case 'stamp':     cmdStamp(args);                            break;
  case 'beacon':    cmdBeacon(args);                           break;
  case 'help':
  case '--help':
  case '-h':        cmdHelp();                                 break;
  default:
    if (!cmd) {
      cmdHelp();
    } else {
      console.error(c.red(`Unknown command: ${cmd}`));
      console.error(c.dim('Run r0 help for usage.'));
      process.exit(2);
    }
}
