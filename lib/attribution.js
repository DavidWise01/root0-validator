'use strict';

// ROOT0 Attribution Standard v1.0 — Validator
// https://github.com/DavidWise01/attribution-standard

const VALID_SUBSTRATES = ['human', 'synthetic', 'hybrid'];
const VALID_ROLES      = ['architect', 'co-author', 'executor', 'reviewer', 'witness'];
const VALID_CONTEXTS   = ['code', 'document', 'creative', 'research', 'governance'];
const REQUIRED_FORMAT  = 'ROOT0-ATTRIBUTION-v1.0';
const REQUIRED_LAW     = 'Both work. Both fair.';
const DATE_RE          = /^\d{4}-\d{2}-\d{2}$/;

function validateAttribution(obj) {
  const errors   = [];
  const warnings = [];
  const info     = [];

  // ── format ────────────────────────────────────────────────────────────────
  if (!obj.format) {
    errors.push('format: missing — must be "ROOT0-ATTRIBUTION-v1.0"');
  } else if (obj.format !== REQUIRED_FORMAT) {
    errors.push(`format: got "${obj.format}" — must be "${REQUIRED_FORMAT}"`);
  } else {
    info.push(`format: ${obj.format}`);
  }

  // ── project ───────────────────────────────────────────────────────────────
  if (!obj.project || typeof obj.project !== 'string' || !obj.project.trim()) {
    errors.push('project: missing or empty');
  } else {
    info.push(`project: ${obj.project}`);
  }

  // ── law ───────────────────────────────────────────────────────────────────
  if (!obj.law) {
    errors.push(`law: missing — must be "${REQUIRED_LAW}"`);
  } else if (obj.law !== REQUIRED_LAW) {
    errors.push(`law: got "${obj.law}" — must be "${REQUIRED_LAW}"`);
  } else {
    info.push(`law: ${obj.law}`);
  }

  // ── optional top-level fields ─────────────────────────────────────────────
  if (obj.context !== undefined) {
    if (!VALID_CONTEXTS.includes(obj.context)) {
      errors.push(`context: "${obj.context}" invalid — must be one of: ${VALID_CONTEXTS.join(', ')}`);
    } else {
      info.push(`context: ${obj.context}`);
    }
  }

  if (obj.date !== undefined && !DATE_RE.test(obj.date)) {
    errors.push(`date: "${obj.date}" invalid — must be YYYY-MM-DD`);
  } else if (obj.date) {
    info.push(`date: ${obj.date}`);
  }

  if (obj.version)   info.push(`version: ${obj.version}`);
  if (obj.license)   info.push(`license: ${obj.license}`);
  if (obj.framework) info.push(`framework: ${obj.framework}`);

  // ── lineage fields (optional) ─────────────────────────────────────────────
  if (obj.parent !== undefined) {
    if (typeof obj.parent !== 'string' || !obj.parent.trim()) {
      warnings.push('parent: present but empty — should be a GitHub URL or project name');
    } else if (!obj.parent.includes('github.com') && !obj.parent.startsWith('ROOT0:')) {
      warnings.push(`parent: "${obj.parent}" — expected a github.com URL or ROOT0:<name> ref`);
    } else {
      info.push(`parent: ${obj.parent}`);
    }
  }

  if (obj.sha256 !== undefined) {
    if (typeof obj.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(obj.sha256)) {
      warnings.push('sha256: present but not a valid 64-char hex string');
    } else {
      info.push(`sha256: ${obj.sha256.slice(0, 16)}...`);
    }
  }

  // ── contributors ──────────────────────────────────────────────────────────
  if (!Array.isArray(obj.contributors) || obj.contributors.length === 0) {
    errors.push('contributors: missing or empty array — at least one contributor required');
    return { valid: false, errors, warnings, info };
  }

  info.push(`contributors: ${obj.contributors.length} found`);

  const weights      = [];
  const hasAnyWeight = obj.contributors.some(c => c.weight !== undefined);

  obj.contributors.forEach((c, i) => {
    const prefix = `contributors[${i}] (${c.name || 'unnamed'})`;

    if (!c.name || typeof c.name !== 'string' || !c.name.trim()) {
      errors.push(`${prefix}: name missing or empty`);
    }

    if (!c.substrate) {
      errors.push(`${prefix}: substrate missing — must be one of: ${VALID_SUBSTRATES.join(', ')}`);
    } else if (!VALID_SUBSTRATES.includes(c.substrate)) {
      errors.push(`${prefix}: substrate "${c.substrate}" invalid`);
    }

    if (!c.role) {
      errors.push(`${prefix}: role missing — must be one of: ${VALID_ROLES.join(', ')}`);
    } else if (!VALID_ROLES.includes(c.role)) {
      errors.push(`${prefix}: role "${c.role}" invalid`);
    }

    if (!c.contribution || typeof c.contribution !== 'string' || !c.contribution.trim()) {
      errors.push(`${prefix}: contribution missing or empty`);
    }

    // synthetic contributors must have provider + model
    if (c.substrate === 'synthetic') {
      if (!c.provider) errors.push(`${prefix}: substrate is "synthetic" — provider required`);
      if (!c.model)    errors.push(`${prefix}: substrate is "synthetic" — model required`);
    }

    // weight
    if (hasAnyWeight) {
      if (c.weight === undefined) {
        errors.push(`${prefix}: weight missing — if any contributor has weight, all must`);
      } else if (typeof c.weight !== 'number' || c.weight < 0 || c.weight > 1) {
        errors.push(`${prefix}: weight must be a number between 0.0 and 1.0`);
      } else {
        weights.push(c.weight);
      }
    }

    // info line per contributor
    const sub   = c.substrate || '?';
    const role  = c.role || '?';
    const model = c.model ? ` [${c.provider} · ${c.model}]` : '';
    const wt    = c.weight !== undefined ? ` weight=${c.weight}` : '';
    info.push(`  ${c.name || 'unnamed'}: ${sub} · ${role}${model}${wt}`);
  });

  // weight sum check
  if (hasAnyWeight && weights.length === obj.contributors.length) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      errors.push(`weights: sum is ${sum.toFixed(4)} — must equal 1.0`);
    } else {
      info.push(`weights: ${weights.join(' + ')} = ${sum.toFixed(4)} ✓`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
  };
}

module.exports = { validateAttribution };
