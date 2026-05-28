#!/usr/bin/env node
'use strict';

// ROOT0 Validator CLI — r0
// https://github.com/DavidWise01/root0-validator
//
// Usage:
//   r0 validate <file|dir>    validate .attribution file(s)
//   r0 sha <file> [hash]      compute or verify SHA256
//   r0 ternary                print ternary spec constants
//   r0 whoami                 print ROOT0 framework identity
//   r0 help                   show this help

const fs   = require('fs');
const path = require('path');

const { validateAttribution }      = require('./lib/attribution');
const { computeSHA256, checkSHA256, KNOWN_HASHES } = require('./lib/sha');
const { SPEC, stateCount }         = require('./lib/ternary');

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
  console.log(`  ${c.cyan('r0 help')}                  show this help`);
  console.log();
  console.log(c.bold('Examples'));
  console.log(`  ${c.dim('r0 validate .attribution')}`);
  console.log(`  ${c.dim('r0 validate ./my-project')}`);
  console.log(`  ${c.dim('r0 sha stoicheion.pdf 02880745b847...')}`);
  console.log(`  ${c.dim('r0 sha any-file.pdf')}`);
  console.log(`  ${c.dim('r0 ternary')}`);
  console.log();
  console.log(c.bold('Exit codes'));
  console.log(`  ${c.mint('0')}  valid / match`);
  console.log(`  ${c.red('1')}  invalid / mismatch`);
  console.log(`  ${c.gold('2')}  usage error`);
  console.log();
  console.log(c.dim('  https://github.com/DavidWise01/root0-validator'));
  console.log();
}

// ── MAIN ──────────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'validate': cmdValidate(args[0]);       break;
  case 'sha':      cmdSha(args[0], args[1]);   break;
  case 'ternary':  cmdTernary();               break;
  case 'whoami':   cmdWhoami();                break;
  case 'help':
  case '--help':
  case '-h':       cmdHelp();                  break;
  default:
    if (!cmd) {
      cmdHelp();
    } else {
      console.error(c.red(`Unknown command: ${cmd}`));
      console.error(c.dim('Run r0 help for usage.'));
      process.exit(2);
    }
}
