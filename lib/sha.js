'use strict';

// ROOT0 SHA256 checker
// Known hashes from root0-registry

const crypto = require('crypto');
const fs     = require('fs');

// Known ROOT0 asset hashes
const KNOWN_HASHES = {
  '02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763': {
    name: 'STOICHEION v11.0',
    repo: 'https://github.com/DavidWise01/stoicheion',
    prior_art: '2026-02-02',
    zenodo: '10.5281/zenodo.19122994',
  },
};

function computeSHA256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function checkSHA256(filePath, expectedHash) {
  const actual = computeSHA256(filePath);
  const known  = KNOWN_HASHES[actual];
  const match  = expectedHash ? (actual === expectedHash) : null;

  return {
    file:     filePath,
    actual,
    expected: expectedHash || null,
    match,
    known:    known || null,
  };
}

function addKnownHash(hash, meta) {
  KNOWN_HASHES[hash] = meta;
}

module.exports = { computeSHA256, checkSHA256, addKnownHash, KNOWN_HASHES };
