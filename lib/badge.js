'use strict';

// ROOT0 badge generator — produces shields.io markdown + ASCII badge

// shields.io badge URL for ROOT0 Attribution
function shieldsUrl(project, valid) {
  const label   = 'ROOT0';
  const message = 'Attribution%20v1.0';
  const color   = valid ? '67e8f9' : 'ef4444';  // cyan = valid, red = invalid
  return `https://img.shields.io/badge/${encodeURIComponent(label)}-${message}-${color}?style=flat-square`;
}

// Markdown img tag
function markdownBadge(project, valid) {
  const url  = shieldsUrl(project, valid);
  const alt  = valid ? 'ROOT0 Attribution v1.0' : 'ROOT0 Attribution — INVALID';
  return `[![${alt}](${url})](https://github.com/DavidWise01/attribution-standard)`;
}

// HTML anchor + img
function htmlBadge(project, valid) {
  const url = shieldsUrl(project, valid);
  const alt = valid ? 'ROOT0 Attribution v1.0' : 'ROOT0 Attribution — INVALID';
  return `<a href="https://github.com/DavidWise01/attribution-standard"><img src="${url}" alt="${alt}"></a>`;
}

// Compact ASCII badge for terminal display
function asciiBadge(valid) {
  return valid
    ? '[ ROOT0 · Attribution v1.0 · ✓ ]'
    : '[ ROOT0 · Attribution v1.0 · ✗ ]';
}

// Summarise an attribution object for badge display
function summariseBadge(obj) {
  const contributors = (obj.contributors || []).map(c => {
    const parts = [c.name, c.substrate];
    if (c.weight !== undefined) parts.push(`weight=${c.weight}`);
    if (c.model)  parts.push(c.model);
    return parts.join(' · ');
  });

  return {
    project:      obj.project  || '(unnamed)',
    format:       obj.format   || '',
    version:      obj.version  || '',
    context:      obj.context  || '',
    license:      obj.license  || '',
    law:          obj.law      || '',
    date:         obj.date     || '',
    contributors,
  };
}

module.exports = { shieldsUrl, markdownBadge, htmlBadge, asciiBadge, summariseBadge };
