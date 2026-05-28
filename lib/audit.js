'use strict';

// ROOT0 r0 audit — GitHub API attribution coverage report
// No external dependencies — uses Node.js built-in https

const https = require('https');
const { validateAttribution }              = require('./attribution');
const { buildLocalChain, isCertified }     = require('./lineage');

// ── HTTP helper ───────────────────────────────────────────────────────────

function apiGet(url, token) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent':  'root0-validator/1.0 (https://github.com/DavidWise01/root0-validator)',
      'Accept':      'application/vnd.github.v3+json',
    };
    if (token) headers['Authorization'] = `token ${token}`;

    https.get(url, { headers }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({
        status:  res.statusCode,
        headers: res.headers,
        body,
      }));
    }).on('error', reject);
  });
}

// ── Rate-limit detection ──────────────────────────────────────────────────

function parseRateLimit(headers) {
  const remaining = parseInt(headers['x-ratelimit-remaining'] || '60', 10);
  const reset     = parseInt(headers['x-ratelimit-reset']     || '0',  10);
  const resetDate = reset ? new Date(reset * 1000).toISOString() : null;
  return { remaining, resetDate };
}

// ── Repo list (paginated) ─────────────────────────────────────────────────

async function fetchRepos(username, token) {
  const repos = [];
  let page  = 1;
  let rateInfo = null;

  while (true) {
    const url = `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=updated&direction=desc`;
    const res = await apiGet(url, token);
    rateInfo  = parseRateLimit(res.headers);

    if (res.status === 404) {
      throw new Error(`GitHub user not found: ${username}`);
    }
    if (res.status === 403) {
      const msg = rateInfo.resetDate
        ? `Rate limited. Resets at ${rateInfo.resetDate}. Use --token to increase limit.`
        : 'Access forbidden. Check your token.';
      throw new Error(msg);
    }
    if (res.status !== 200) {
      throw new Error(`GitHub API error ${res.status}: ${res.body}`);
    }

    const batch = JSON.parse(res.body);
    repos.push(...batch);
    if (batch.length < 100) break;  // no more pages
    page++;
  }

  return { repos, rateInfo };
}

// ── Attribution check for one repo ───────────────────────────────────────

async function checkRepAttribution(username, repoName, token) {
  const url = `https://api.github.com/repos/${username}/${repoName}/contents/.attribution`;
  let res;
  try {
    res = await apiGet(url, token);
  } catch (e) {
    return { found: false, error: e.message };
  }

  if (res.status === 404) return { found: false };
  if (res.status === 403) return { found: false, error: 'rate limited or forbidden' };
  if (res.status !== 200) return { found: false, error: `API error ${res.status}` };

  // Decode base64 content returned by GitHub contents API
  return parseAttributionResponse(res.body);
}

// Pure function — parse a GitHub contents API response body string
function parseAttributionResponse(responseBody) {
  try {
    const file    = JSON.parse(responseBody);
    const raw     = Buffer.from(file.content, 'base64').toString('utf8');
    const obj     = JSON.parse(raw);
    const { valid, errors, warnings } = validateAttribution(obj);
    const chain      = buildLocalChain(obj);
    const certified  = isCertified(chain);
    const framework  = obj.framework || null;
    return { found: true, valid, errors, warnings, project: obj.project || null, certified, framework };
  } catch (e) {
    return { found: true, valid: false, errors: [`parse error: ${e.message}`], warnings: [], certified: false, framework: null };
  }
}

// ── Concurrent batch runner ───────────────────────────────────────────────

async function runBatch(tasks, batchSize = 5) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const slice = tasks.slice(i, i + batchSize);
    const batch = await Promise.all(slice.map(fn => fn()));
    results.push(...batch);
  }
  return results;
}

// ── Main audit function ───────────────────────────────────────────────────

async function runAudit(username, token, opts = {}) {
  // 1. Fetch repo list
  const { repos, rateInfo } = await fetchRepos(username, token);

  // 2. Check .attribution in parallel batches of 5
  const tasks = repos.map(repo => () =>
    checkRepAttribution(username, repo.name, token).then(attr => ({
      repo:        repo.name,
      description: repo.description || '',
      url:         repo.html_url,
      archived:    repo.archived,
      fork:        repo.fork,
      pushed_at:   repo.pushed_at,
      ...attr,
    }))
  );

  const results = await runBatch(tasks, opts.batchSize || 5);

  // 3. Tally
  const covered    = results.filter(r => r.found && r.valid).length;
  const certified  = results.filter(r => r.found && r.valid && r.certified).length;
  const invalid    = results.filter(r => r.found && !r.valid).length;
  const missing    = results.filter(r => !r.found).length;
  const total      = results.length;
  const pct        = total > 0 ? Math.round((covered  / total) * 100) : 0;
  const certPct    = covered > 0 ? Math.round((certified / covered) * 100) : 0;

  return {
    username,
    total,
    covered,
    certified,
    invalid,
    missing,
    pct,
    certPct,
    rateInfo,
    results,
  };
}

module.exports = { runAudit, fetchRepos, checkRepAttribution, parseAttributionResponse, runBatch };
