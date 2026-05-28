#!/usr/bin/env node
'use strict';

// ROOT0 Validator CLI — r0
// https://github.com/DavidWise01/root0-validator
//
// Usage:
//   r0 validate <file|dir>    validate .attribution file(s)
//   r0 sha <file> [hash]      compute or verify SHA256
//   r0 ternary                print ternary spec constants
//   r0 init [dir]             scaffold a new .attribution file
//   r0 scan [dir]             find projects missing .attribution
//   r0 ladder [n]             doubt ladder analysis
//   r0 whoami                 print ROOT0 framework identity
//   r0 help                   show this help

const fs   = require('fs');
const path = require('path');

const { validateAttribution }                       = require('./lib/attribution');
const { computeSHA256, checkSHA256, KNOWN_HASHES }  = require('./lib/sha');
const { SPEC, stateCount }                          = require('./lib/ternary');
const { runInit }                                   = require('./lib/init');
const { scanDir }                                   = require('./lib/scan');

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
  header('r0  ROOT0 Validator v1.0');
  console.log();
  console.log(c.bold('Commands'));
  console.log(`  ${c.cyan('r0 validate')} ${c.dim('<file|dir>')}   validate .attribution file(s)`);
  console.log(`  ${c.cyan('r0 sha')}      ${c.dim('<file> [hash]')} compute or verify SHA256`);
  console.log(`  ${c.cyan('r0 ternary')}               print ROOT0 ternary spec constants`);
  console.log(`  ${c.cyan('r0 whoami')}                print ROOT0 framework identity`);
  console.log(`  ${c.cyan('r0 init')}     ${c.dim('[dir]')}         scaffold a new .attribution file`);
  console.log(`  ${c.cyan('r0 scan')}     ${c.dim('[dir]')}         find projects missing .attribution`);
  console.log(`  ${c.cyan('r0 ladder')}   ${c.dim('[rung]')}        doubt ladder analysis (all or specific rung)`);
  console.log(`  ${c.cyan('r0 help')}                  show this help`);
  console.log();
  console.log(c.bold('Examples'));
  console.log(`  ${c.dim('r0 validate .attribution')}`);
  console.log(`  ${c.dim('r0 validate ./my-project')}`);
  console.log(`  ${c.dim('r0 sha stoicheion.pdf 02880745b847...')}`);
  console.log(`  ${c.dim('r0 init')}`);
  console.log(`  ${c.dim('r0 scan "C:/Davids files"')}`);
  console.log(`  ${c.dim('r0 ladder 5')}`);
  console.log(`  ${c.dim('r0 ladder')}`);
  console.log();
  console.log(c.bold('Exit codes'));
  console.log(`  ${c.mint('0')}  valid / match`);
  console.log(`  ${c.red('1')}  invalid / mismatch`);
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

// ── MAIN ──────────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'validate': cmdValidate(args[0]);         break;
  case 'sha':      cmdSha(args[0], args[1]);     break;
  case 'ternary':  cmdTernary();                 break;
  case 'whoami':   cmdWhoami();                  break;
  case 'init':     cmdInit(args[0]);             break;
  case 'scan':     cmdScan(args[0]);             break;
  case 'ladder':   cmdLadder(args[0]);           break;
  case 'help':
  case '--help':
  case '-h':       cmdHelp();                    break;
  default:
    if (!cmd) {
      cmdHelp();
    } else {
      console.error(c.red(`Unknown command: ${cmd}`));
      console.error(c.dim('Run r0 help for usage.'));
      process.exit(2);
    }
}
