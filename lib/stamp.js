'use strict';

// ROOT0 r0 stamp — non-interactive .attribution batch stamper
//
// Profile stored at ~/.r0-profile.json
// One-time setup: r0 stamp --setup
// Stamp one repo:  r0 stamp [dir]
// Stamp all missing in a tree: r0 stamp --all [root]

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const { validateAttribution } = require('./attribution');
const { scanDir }             = require('./scan');

const PROFILE_PATH = path.join(os.homedir(), '.r0-profile.json');

// ── Profile ───────────────────────────────────────────────────────────────

const DEFAULT_PROFILE = {
  human: {
    name:         'David Lee Wise',
    handle:       'ROOT0',
    substrate:    'human',
    role:         'architect',
    contribution: 'intent · direction · governance',
  },
  ai: {
    name:         'AVAN',
    substrate:    'synthetic',
    provider:     'Anthropic',
    model:        'Claude Sonnet 4.6',
    role:         'co-author',
    contribution: 'intellect · generation · execution',
  },
  defaults: {
    license:   'CC-BY-ND-4.0',
    framework: 'STOICHEION v11.0',
    law:       'Both work. Both fair.',
    context:   'code',
    version:   'v1.0',
  },
};

function loadProfile() {
  if (!fs.existsSync(PROFILE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveProfile(profile) {
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2) + '\n', 'utf8');
}

function ensureProfile() {
  const existing = loadProfile();
  if (existing) return existing;
  // Write default profile on first use
  saveProfile(DEFAULT_PROFILE);
  return DEFAULT_PROFILE;
}

// ── Attribution object builder ────────────────────────────────────────────

function buildAttribution(projectName, profile, overrides = {}) {
  const d = profile.defaults || {};
  const h = profile.human   || {};
  const a = profile.ai      || null;

  const contributors = [
    {
      name:         h.name         || 'Unknown',
      handle:       h.handle       || undefined,
      substrate:    h.substrate    || 'human',
      role:         h.role         || 'architect',
      contribution: h.contribution || 'intent · direction · governance',
    },
  ];

  // Remove undefined handle
  if (!contributors[0].handle) delete contributors[0].handle;

  if (a && a.name) {
    contributors.push({
      name:         a.name,
      substrate:    a.substrate    || 'synthetic',
      provider:     a.provider     || 'Anthropic',
      model:        a.model        || 'Claude Sonnet 4.6',
      role:         a.role         || 'co-author',
      contribution: a.contribution || 'intellect · generation · execution',
    });
  }

  const obj = {
    format:       'ROOT0-ATTRIBUTION-v1.0',
    project:      overrides.project  || projectName,
    version:      overrides.version  || d.version  || 'v1.0',
    context:      overrides.context  || d.context  || 'code',
    date:         overrides.date     || new Date().toISOString().slice(0, 10),
    license:      overrides.license  || d.license  || 'CC-BY-ND-4.0',
    framework:    overrides.framework || d.framework || 'STOICHEION v11.0',
    law:          d.law || 'Both work. Both fair.',
    contributors,
  };

  return obj;
}

// ── Stamp one directory ───────────────────────────────────────────────────

function stampDir(dirPath, profile, overrides = {}) {
  const outFile    = path.join(dirPath, '.attribution');
  const projectName = overrides.project || path.basename(dirPath);

  if (fs.existsSync(outFile)) {
    return { skipped: true, reason: 'already exists', path: outFile };
  }

  const obj = buildAttribution(projectName, profile, overrides);

  // Validate before writing
  const { valid, errors } = validateAttribution(obj);
  if (!valid) {
    return { skipped: true, reason: `validation failed: ${errors[0]}`, path: outFile };
  }

  fs.writeFileSync(outFile, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  return { stamped: true, path: outFile, obj };
}

// ── Batch stamp (all missing in a tree) ───────────────────────────────────

function stampAll(rootPath, profile, opts = {}) {
  const { dryRun = false, overrides = {} } = opts;
  const results = scanDir(rootPath);

  const missing  = results.filter(r => !r.found);
  const already  = results.filter(r =>  r.found);

  const stamped  = [];
  const skipped  = [];
  const errors   = [];

  missing.forEach(r => {
    if (dryRun) {
      stamped.push({ dir: r.dir, name: r.name, dryRun: true });
      return;
    }
    try {
      const result = stampDir(r.dir, profile, overrides);
      if (result.stamped) stamped.push({ dir: r.dir, name: r.name, path: result.path });
      else skipped.push({ dir: r.dir, name: r.name, reason: result.reason });
    } catch (e) {
      errors.push({ dir: r.dir, name: r.name, error: e.message });
    }
  });

  already.forEach(r => {
    skipped.push({ dir: r.dir, name: r.name, reason: 'already has .attribution' });
  });

  return { stamped, skipped, errors, total: results.length };
}

module.exports = {
  loadProfile, saveProfile, ensureProfile, buildAttribution,
  stampDir, stampAll,
  PROFILE_PATH, DEFAULT_PROFILE,
};
