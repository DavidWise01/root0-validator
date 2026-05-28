'use strict';

// r0 scan — find projects missing .attribution files

const fs   = require('fs');
const path = require('path');

const { validateAttribution } = require('./attribution');

// Directories that indicate a project root
const PROJECT_SIGNALS = [
  '.git', 'package.json', 'README.md', 'readme.md',
  'index.html', 'index.js', 'main.py', 'main.rs',
  'Makefile', 'CMakeLists.txt', '.attribution',
];

// Directories to skip entirely
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.vscode', '__pycache__',
  'dist', 'build', '.next', 'vendor', 'target',
]);

function isProjectDir(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    return PROJECT_SIGNALS.some(sig => entries.includes(sig));
  } catch { return false; }
}

function hasAttribution(dirPath) {
  const filePath = path.join(dirPath, '.attribution');
  if (!fs.existsSync(filePath)) return { found: false };

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(raw);
    const { valid, errors } = validateAttribution(obj);
    return { found: true, valid, errors, filePath };
  } catch (e) {
    return { found: true, valid: false, errors: [`JSON parse error: ${e.message}`], filePath };
  }
}

function scanDir(rootPath, depth = 0, maxDepth = 3) {
  const results = [];

  let entries;
  try {
    entries = fs.readdirSync(rootPath);
  } catch { return results; }

  // Check if rootPath itself looks like a project
  if (depth > 0 && isProjectDir(rootPath)) {
    const attr = hasAttribution(rootPath);
    results.push({
      dir:      rootPath,
      name:     path.relative(path.dirname(rootPath), rootPath),
      ...attr,
    });
    // Don't recurse deeper into a project dir
    return results;
  }

  if (depth >= maxDepth) return results;

  // Recurse into subdirectories
  entries.forEach(entry => {
    if (SKIP_DIRS.has(entry)) return;
    const full = path.join(rootPath, entry);
    try {
      if (fs.statSync(full).isDirectory()) {
        results.push(...scanDir(full, depth + 1, maxDepth));
      }
    } catch {}
  });

  return results;
}

module.exports = { scanDir, hasAttribution };
