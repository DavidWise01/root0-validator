'use strict';

// ROOT0 Lineage Tracker
// Traces the provenance chain: project → framework → ROOT0 foundation
//
// Chain model:
//   [project]
//     └── framework: "STOICHEION v11.0"           (existing attribution field)
//           └── SHA256: 02880745b847... ✓ verified
//                 └── prior_art: 2026-02-02
//                       └── ROOT0 / TriPod LLC  ← CERTIFIED
//
// Optional explicit chaining via parent field:
//   [child project]
//     └── parent: "https://github.com/DavidWise01/root0-registry"
//           └── [parent project]
//                 └── framework: STOICHEION v11.0 ✓

const https = require('https');

// ── Known framework → SHA256 map ─────────────────────────────────────────
// (reverse of KNOWN_HASHES in sha.js — keyed by name)

const KNOWN_FRAMEWORKS = {
  'STOICHEION v11.0': {
    sha256:    '02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763',
    author:    'David Lee Wise / ROOT0 / TriPod LLC',
    prior_art: '2026-02-02',
    zenodo:    '10.5281/zenodo.19122994',
    repo:      'https://github.com/DavidWise01/stoicheion',
    law:       'Both work. Both fair.',
  },
};

// Also accept partial name match (e.g. "STOICHEION" or "STOICHEION v11")
function resolveFramework(name) {
  if (!name) return null;
  if (KNOWN_FRAMEWORKS[name]) return { name, ...KNOWN_FRAMEWORKS[name] };
  const key = Object.keys(KNOWN_FRAMEWORKS).find(k =>
    k.toLowerCase().startsWith(name.toLowerCase())
  );
  return key ? { name: key, ...KNOWN_FRAMEWORKS[key] } : null;
}

// ── Link types ────────────────────────────────────────────────────────────

function projectLink(attrObj, depth = 0) {
  return {
    type:         'project',
    depth,
    name:         attrObj.project || '(unnamed)',
    format:       attrObj.format  || null,
    law:          attrObj.law     || null,
    framework:    attrObj.framework || null,
    parent:       attrObj.parent  || null,
    sha256:       attrObj.sha256  || null,
    contributors: (attrObj.contributors || []).map(c => ({
      name:      c.name,
      substrate: c.substrate,
      role:      c.role,
    })),
  };
}

function frameworkLink(frameworkName, resolved, depth) {
  return {
    type:      'framework',
    depth,
    name:      frameworkName,
    verified:  !!resolved,
    sha256:    resolved ? resolved.sha256 : null,
    prior_art: resolved ? resolved.prior_art : null,
    zenodo:    resolved ? resolved.zenodo   : null,
    repo:      resolved ? resolved.repo     : null,
    author:    resolved ? resolved.author   : null,
    law:       resolved ? resolved.law      : null,
  };
}

function foundationLink(fw, depth) {
  return {
    type:      'foundation',
    depth,
    name:      fw.author || 'ROOT0 / TriPod LLC',
    law:       fw.law,
    prior_art: fw.prior_art,
    certified: true,
  };
}

// ── Chain builder (local — no network) ────────────────────────────────────

function buildLocalChain(attrObj) {
  const chain = [];

  // Level 0 — project itself
  chain.push(projectLink(attrObj, 0));

  // Level 1 — framework (if present)
  if (attrObj.framework) {
    const fw = resolveFramework(attrObj.framework);
    chain.push(frameworkLink(attrObj.framework, fw, 1));

    // Level 2 — ROOT0 foundation (only if framework SHA is known)
    if (fw) chain.push(foundationLink(fw, 2));
  }

  return chain;
}

// ── Certification check ───────────────────────────────────────────────────

function isCertified(chain) {
  return chain.some(link => link.type === 'foundation' && link.certified);
}

function certificationDepth(chain) {
  const f = chain.findIndex(link => link.type === 'foundation' && link.certified);
  return f === -1 ? 0 : chain[f].depth;
}

// ── Remote parent fetch (GitHub) ──────────────────────────────────────────
// Follows parent field: "https://github.com/DavidWise01/root0-registry"
// → fetches .attribution from GitHub API

function extractGitHubCoords(url) {
  // Accepts: https://github.com/USER/REPO  or  github.com/USER/REPO
  const m = url.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (!m) return null;
  return { user: m[1], repo: m[2] };
}

function fetchRemoteAttribution(parentUrl, token) {
  return new Promise((resolve) => {
    const coords = extractGitHubCoords(parentUrl);
    if (!coords) return resolve(null);

    const apiUrl = `https://api.github.com/repos/${coords.user}/${coords.repo}/contents/.attribution`;
    const headers = {
      'User-Agent': 'root0-validator',
      'Accept':     'application/vnd.github.v3+json',
    };
    if (token) headers['Authorization'] = `token ${token}`;

    https.get(apiUrl, { headers }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null);
        try {
          const file = JSON.parse(body);
          const raw  = Buffer.from(file.content, 'base64').toString('utf8');
          resolve(JSON.parse(raw));
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ── Full chain builder (with optional network parent traversal) ────────────
// maxDepth prevents infinite loops in circular lineage

async function buildChain(attrObj, opts = {}) {
  const { token = null, maxDepth = 5 } = opts;
  const chain = [];
  let current = attrObj;
  let depth   = 0;

  while (current && depth <= maxDepth) {
    chain.push(projectLink(current, depth));

    // If there's a parent pointer and we haven't hit bottom, follow it
    if (current.parent && depth < maxDepth) {
      const parentAttr = await fetchRemoteAttribution(current.parent, token);
      if (parentAttr) {
        // Add a "link" node showing the parent jump
        chain.push({
          type:   'parent-link',
          depth:  depth + 0.5,
          url:    current.parent,
          name:   parentAttr.project || current.parent,
        });
        current = parentAttr;
        depth++;
        continue;
      }
    }

    // Bottom reached — check framework
    if (current.framework) {
      const fw = resolveFramework(current.framework);
      chain.push(frameworkLink(current.framework, fw, depth + 1));
      if (fw) chain.push(foundationLink(fw, depth + 2));
    }
    break;
  }

  return chain;
}

module.exports = {
  buildChain,
  buildLocalChain,
  resolveFramework,
  isCertified,
  certificationDepth,
  extractGitHubCoords,
  KNOWN_FRAMEWORKS,
};
