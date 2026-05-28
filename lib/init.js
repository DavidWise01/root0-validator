'use strict';

// r0 init — .attribution file scaffold wizard

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const VALID_ROLES    = ['architect', 'co-author', 'executor', 'reviewer', 'witness'];
const VALID_CONTEXTS = ['code', 'document', 'creative', 'research', 'governance'];

function ask(rl, question, defaultVal) {
  return new Promise(resolve => {
    const prompt = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `;
    rl.question(prompt, answer => {
      resolve(answer.trim() || defaultVal || '');
    });
  });
}

function askChoice(rl, question, choices, defaultVal) {
  return new Promise(resolve => {
    const list   = choices.join('/');
    const prompt = `${question} (${list}) [${defaultVal}]: `;
    rl.question(prompt, answer => {
      const val = answer.trim() || defaultVal;
      if (choices.includes(val)) resolve(val);
      else {
        console.log(`  Invalid choice. Using default: ${defaultVal}`);
        resolve(defaultVal);
      }
    });
  });
}

function askBool(rl, question, defaultVal = 'y') {
  return new Promise(resolve => {
    rl.question(`${question} (y/n) [${defaultVal}]: `, answer => {
      const val = answer.trim().toLowerCase() || defaultVal;
      resolve(val === 'y' || val === 'yes');
    });
  });
}

async function runInit(outputDir) {
  const dir      = path.resolve(outputDir || '.');
  const outFile  = path.join(dir, '.attribution');
  const dirName  = path.basename(dir);
  const isTTY    = process.stdout.isTTY;

  const c = {
    cyan:   s => isTTY ? `\x1b[96m${s}\x1b[0m` : s,
    mint:   s => isTTY ? `\x1b[92m${s}\x1b[0m` : s,
    gold:   s => isTTY ? `\x1b[93m${s}\x1b[0m` : s,
    dim:    s => isTTY ? `\x1b[2m${s}\x1b[0m`  : s,
    bold:   s => isTTY ? `\x1b[1m${s}\x1b[0m`  : s,
  };

  if (fs.existsSync(outFile)) {
    console.log(c.gold(`  .attribution already exists at ${outFile}`));
    console.log(c.dim('  Use r0 validate to check it, or delete it to re-scaffold.'));
    process.exit(0);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log();
  console.log(c.dim('  Press Enter to accept defaults shown in [brackets].'));
  console.log();

  // ── project info ────────────────────────────────────────────────────────
  const project = await ask(rl, '  Project name', dirName);
  const version = await ask(rl, '  Version', 'v1.0');
  const context = await askChoice(rl, '  Context', VALID_CONTEXTS, 'code');
  const license = await ask(rl, '  License', 'CC-BY-ND-4.0');

  console.log();
  console.log(c.dim('  ── Human contributor ──────────────────────────────'));

  // ── human contributor ────────────────────────────────────────────────────
  const humanName   = await ask(rl, '  Name', 'David Lee Wise');
  const humanHandle = await ask(rl, '  Handle', 'ROOT0');
  const humanRole   = await askChoice(rl, '  Role', VALID_ROLES, 'architect');
  const humanContrib = await ask(rl, '  Contribution', 'intent · direction · governance');

  // ── AI contributor ───────────────────────────────────────────────────────
  console.log();
  const addAI = await askBool(rl, '  Add AI contributor?', 'y');

  let aiContrib = null;
  if (addAI) {
    console.log(c.dim('  ── AI contributor ─────────────────────────────────'));
    const aiName     = await ask(rl, '  Name', 'AVAN');
    const aiProvider = await ask(rl, '  Provider', 'Anthropic');
    const aiModel    = await ask(rl, '  Model', 'Claude Sonnet 4.6');
    const aiRole     = await askChoice(rl, '  Role', VALID_ROLES, 'co-author');
    const aiContribText = await ask(rl, '  Contribution', 'intellect · generation · execution');

    aiContrib = {
      name:         aiName,
      substrate:    'synthetic',
      provider:     aiProvider,
      model:        aiModel,
      role:         aiRole,
      contribution: aiContribText,
    };
  }

  rl.close();

  // ── build object ─────────────────────────────────────────────────────────
  const contributors = [
    {
      name:         humanName,
      handle:       humanHandle,
      substrate:    'human',
      role:         humanRole,
      contribution: humanContrib,
    },
  ];

  if (aiContrib) contributors.push(aiContrib);

  const obj = {
    format:       'ROOT0-ATTRIBUTION-v1.0',
    project,
    version,
    context,
    date:         new Date().toISOString().slice(0, 10),
    license,
    framework:    'STOICHEION v11.0',
    law:          'Both work. Both fair.',
    contributors,
  };

  // ── write ────────────────────────────────────────────────────────────────
  const json = JSON.stringify(obj, null, 2);
  fs.writeFileSync(outFile, json, 'utf8');

  console.log();
  console.log(c.mint('  ✓  .attribution written'));
  console.log(c.dim(`     ${outFile}`));
  console.log();
  console.log(c.dim(json));
  console.log();
  console.log(c.dim(`  Run: r0 validate ${outFile}`));
  console.log();
}

module.exports = { runInit };
