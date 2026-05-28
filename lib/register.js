'use strict';

// ROOT0 user hash registry — ~/.r0-registry.json
// Extends built-in KNOWN_HASHES with user-registered assets

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const REGISTRY_PATH = path.join(os.homedir(), '.r0-registry.json');

function loadUserRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return {};
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveUserRegistry(registry) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf8');
}

function registerHash(sha256, name, opts = {}) {
  const hash = sha256.trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error('SHA256 must be exactly 64 lowercase hex characters');
  }
  if (!name || !name.trim()) {
    throw new Error('Name is required');
  }

  const registry = loadUserRegistry();

  const entry = {
    name:       name.trim(),
    registered: new Date().toISOString().slice(0, 10),
    by:         opts.by       || 'ROOT0',
  };
  if (opts.prior_art) entry.prior_art = opts.prior_art;
  if (opts.zenodo)    entry.zenodo    = opts.zenodo;
  if (opts.repo)      entry.repo      = opts.repo;
  if (opts.notes)     entry.notes     = opts.notes;

  const isUpdate = !!registry[hash];
  registry[hash] = entry;
  saveUserRegistry(registry);

  return { hash, entry, registryPath: REGISTRY_PATH, isUpdate };
}

function listRegistry() {
  return loadUserRegistry();
}

function removeHash(sha256) {
  const hash     = sha256.trim().toLowerCase();
  const registry = loadUserRegistry();
  if (!registry[hash]) return false;
  delete registry[hash];
  saveUserRegistry(registry);
  return true;
}

module.exports = { loadUserRegistry, saveUserRegistry, registerHash, listRegistry, removeHash, REGISTRY_PATH };
