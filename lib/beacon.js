'use strict';

// ROOT0 r0 beacon — content discovery across platforms
//
// Searches for ROOT0 / David Lee Wise content in the wild:
//   GitHub     — external repos + code referencing your work
//   Kindle     — Amazon eBook listings
//   USCO       — US Copyright Office registrations
//   Reddit     — posts and comments mentioning your work
//   TD Commons — tdcommons.org document deposits
//
// Usage:
//   r0 beacon                        scan with profile defaults
//   r0 beacon --term <term>          add extra search term
//   r0 beacon --platform github      single platform only
//   r0 beacon --json                 JSON output
//   r0 beacon --save [file]          save report to .r0-beacon-report.json

const https = require('https');
const http  = require('http');
const os    = require('os');
const path  = require('path');
const fs    = require('fs');

const REPORT_PATH = path.join(os.homedir(), '.r0-beacon-report.json');

// ── HTTP helper ───────────────────────────────────────────────────────────────

function httpGet(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'ROOT0-beacon/1.0 (+https://github.com/DavidWise01/root0-validator)',
        'Accept':     'text/html,application/json,*/*;q=0.9',
        ...opts.headers,
      },
      timeout: 15000,
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({
        status:  res.statusCode,
        headers: res.headers,
        body:    Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`timeout: ${url}`)); });
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── HTTP POST (for model probe API calls) ─────────────────────────────────────

function httpPost(url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const lib   = url.startsWith('https') ? https : http;
    const { URL } = require('url');
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || (url.startsWith('https') ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers: {
        'User-Agent':     'ROOT0-beacon/1.0 (+https://github.com/DavidWise01/root0-validator)',
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...extraHeaders,
      },
      timeout: 25000,
    };
    const req = lib.request(opts, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`timeout: ${url}`)); });
    req.write(body);
    req.end();
  });
}

// ── GitHub ────────────────────────────────────────────────────────────────────

async function searchGitHub(terms, { token, ownUser = 'DavidWise01' } = {}) {
  const results = [];
  const headers = {
    'Accept':     'application/vnd.github.v3+json',
    'User-Agent': 'ROOT0-beacon/1.0',
  };
  if (token) headers['Authorization'] = `token ${token}`;

  for (const term of terms) {
    const q = encodeURIComponent(`"${term}"`);

    // External repos referencing the term
    try {
      const r = await httpGet(
        `https://api.github.com/search/repositories?q=${q}&per_page=10&sort=updated`,
        { headers }
      );
      if (r.status === 200) {
        const data = JSON.parse(r.body);
        for (const item of (data.items || [])) {
          if (item.owner.login.toLowerCase() === ownUser.toLowerCase()) continue;
          results.push({
            platform: 'github', type: 'repo', term,
            title:       item.full_name,
            description: item.description || '',
            url:         item.html_url,
            stars:       item.stargazers_count,
            date:        (item.updated_at || '').slice(0, 10),
            own:         false,
          });
        }
      }
    } catch {}

    await delay(400);

    // Code files referencing the term
    try {
      const r = await httpGet(
        `https://api.github.com/search/code?q=${q}&per_page=8`,
        { headers }
      );
      if (r.status === 200) {
        const data = JSON.parse(r.body);
        for (const item of (data.items || [])) {
          if (item.repository.owner.login.toLowerCase() === ownUser.toLowerCase()) continue;
          results.push({
            platform: 'github', type: 'code', term,
            title: `${item.repository.full_name} / ${item.name}`,
            url:   item.html_url,
            date:  null,
            own:   false,
          });
        }
      }
    } catch {}

    await delay(400);
  }

  return results;
}

// ── Amazon Kindle ─────────────────────────────────────────────────────────────

async function searchKindle(terms) {
  const results = [];

  // Nav/UI noise patterns to reject
  const NOISE = [
    /shift,\s*alt/i, /keyboard/i, /^shortcuts/i, /^main content/i,
    /^\d+ items? in cart/i, /^open all categories/i, /^back to top/i,
    /^amazon us home/i, /^choose a (language|country)/i, /^expand /i,
    /^check each product/i, /^more on amazon/i, /^external link/i,
    /^view (sponsored|previous|next)/i, /^apply \w+ filter/i,
    /^\d+\+? (ratings?|bought)/i, /^buy now with/i, /^add to cart/i,
    /^search[, ]/i, /search, alt,/i, /^apply .+filter/i,
    /^kindle (books|ebooks|deals|unlimited|store|singles|short|active)/i,
    /^(prime|amazon kids|best sellers|nonfiction|department|any department)/i,
    /^(comixology|prime reading|memberships|from our editors|ways to read)/i,
    /^(customer reviews|word wise|no featured|currently unavailable)/i,
    /details$/i, /star[s,]/i, /out of 5/i, /^sponsored ad/i,
    /^from amazon/i, /^small business/i, /^listen with/i,
  ];

  function isNoise(title) {
    if (title.length < 12 || title.length > 250) return true;
    return NOISE.some(re => re.test(title));
  }

  for (const term of terms) {
    const q = encodeURIComponent(term);
    try {
      const r = await httpGet(
        `https://www.amazon.com/s?k=${q}&i=digital-text`,
        { headers: { 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html' } }
      );

      if (r.status === 200) {
        const seen = new Set();
        let m;

        // Amazon book titles appear as aria-labels on product links/containers
        // Min 25 chars filters most nav cruft; noise filter catches the rest
        const ariaRe = /aria-label="([^"]{25,220})"/g;
        while ((m = ariaRe.exec(r.body)) !== null) {
          const title = m[1].replace(/\s+/g, ' ').trim();
          if (!seen.has(title) && !isNoise(title)) {
            seen.add(title);
            results.push({
              platform: 'kindle', type: 'ebook', term,
              title,
              url:  `https://www.amazon.com/s?k=${q}&i=digital-text`,
              date: null,
              own:  null,
            });
          }
        }

        // Fallback: h2 > a > span pattern (older Amazon layout)
        if (seen.size === 0) {
          const h2Re = /<h2[^>]*>\s*(?:<a[^>]*>)?\s*<span[^>]*>([\s\S]{20,220}?)<\/span>/g;
          while ((m = h2Re.exec(r.body)) !== null) {
            const title = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (title && !seen.has(title) && !isNoise(title)) {
              seen.add(title);
              results.push({
                platform: 'kindle', type: 'ebook', term,
                title,
                url:  `https://www.amazon.com/s?k=${q}&i=digital-text`,
                date: null,
                own:  null,
              });
            }
          }
        }
      }
    } catch {}

    await delay(1200);
  }

  return results;
}

// ── USCO ──────────────────────────────────────────────────────────────────────

async function searchUSCO(terms) {
  const results = [];

  for (const term of terms) {
    const q = encodeURIComponent(term);

    // Try newer public records API (Elasticsearch-backed)
    try {
      const r = await httpGet(
        `https://publicrecords.copyright.gov/search-results?searchText=${q}&searchType=All&page=1&perPage=10`
      );
      if (r.status === 200) {
        // API returns JSON embedded in HTML — check both
        try {
          const data = JSON.parse(r.body);
          for (const item of (data.results || data.hits?.hits || [])) {
            const src = item._source || item;
            results.push({
              platform: 'usco', type: 'copyright', term,
              title:     src.title || src.titleOfWork || 'Copyright Registration',
              regNumber: src.registrationNumber || src.regNumber || '',
              url:       `https://publicrecords.copyright.gov/search-results?searchText=${q}`,
              date:      src.dateOfRegistration || src.date || null,
              own:       true,
            });
          }
        } catch {
          // Parse HTML for reg numbers
          const re = /([TX]Xu?\s*[\d-]+)/g;
          let m;
          while ((m = re.exec(r.body)) !== null) {
            const regNum = m[1].trim();
            results.push({
              platform: 'usco', type: 'copyright', term,
              title:     regNum,
              regNumber: regNum,
              url:       `https://publicrecords.copyright.gov/search-results?searchText=${q}`,
              date:      null,
              own:       true,
            });
          }
        }
      }
    } catch {}

    // Fallback: old catalog
    try {
      const r = await httpGet(
        `https://cocatalog.loc.gov/cgi-bin/Pwebrecon.cgi?v1=1&ti=1,1&Search_Arg=${q}&Search_Code=NAME&CNT=25&PID=&SEQ=&SID=1`
      );
      if (r.status === 200 && results.filter(x => x.term === term).length === 0) {
        const re = /((?:TX|VA|PA|SR|SE|RE|TX)[A-Z]?\s*[\d-]+)/g;
        let m;
        const seen = new Set();
        while ((m = re.exec(r.body)) !== null) {
          const reg = m[1].trim();
          if (!seen.has(reg)) {
            seen.add(reg);
            results.push({
              platform: 'usco', type: 'copyright', term,
              title:     reg,
              regNumber: reg,
              url:       `https://cocatalog.loc.gov/cgi-bin/Pwebrecon.cgi?Search_Arg=${q}&Search_Code=NAME`,
              date:      null,
              own:       true,
            });
          }
        }
      }
    } catch {}

    await delay(800);
  }

  return results;
}

// ── Reddit ────────────────────────────────────────────────────────────────────

async function searchReddit(terms, { redditUser } = {}) {
  const results = [];
  const headers = { 'User-Agent': 'ROOT0-beacon/1.0 (+https://github.com/DavidWise01/root0-validator)' };

  for (const term of terms) {
    const q = encodeURIComponent(term);

    // Post search
    try {
      const r = await httpGet(
        `https://www.reddit.com/search.json?q=${q}&type=link&limit=10&sort=new`,
        { headers }
      );
      if (r.status === 200) {
        const data = JSON.parse(r.body);
        for (const child of (data.data?.children || [])) {
          const p = child.data;
          results.push({
            platform: 'reddit', type: 'post', term,
            title:     p.title,
            url:       `https://reddit.com${p.permalink}`,
            subreddit: `r/${p.subreddit}`,
            author:    p.author,
            score:     p.score,
            date:      p.created_utc ? new Date(p.created_utc * 1000).toISOString().slice(0, 10) : null,
            own:       redditUser ? p.author === redditUser : null,
          });
        }
      }
    } catch {}

    await delay(1000);

    // Comment search
    try {
      const r = await httpGet(
        `https://www.reddit.com/search.json?q=${q}&type=comment&limit=8&sort=new`,
        { headers }
      );
      if (r.status === 200) {
        const data = JSON.parse(r.body);
        for (const child of (data.data?.children || [])) {
          const p = child.data;
          const snippet = (p.body || '').replace(/\n/g, ' ').trim().slice(0, 120);
          results.push({
            platform: 'reddit', type: 'comment', term,
            title:     snippet + (snippet.length === 120 ? '…' : ''),
            url:       `https://reddit.com${p.permalink}`,
            subreddit: `r/${p.subreddit}`,
            author:    p.author,
            score:     p.score,
            date:      p.created_utc ? new Date(p.created_utc * 1000).toISOString().slice(0, 10) : null,
            own:       redditUser ? p.author === redditUser : null,
          });
        }
      }
    } catch {}

    await delay(1000);
  }

  // Own profile posts
  if (redditUser) {
    try {
      const r = await httpGet(
        `https://www.reddit.com/user/${redditUser}/submitted.json?limit=25`,
        { headers }
      );
      if (r.status === 200) {
        const data = JSON.parse(r.body);
        for (const child of (data.data?.children || [])) {
          const p = child.data;
          results.push({
            platform: 'reddit', type: 'own-post', term: `u/${redditUser}`,
            title:     p.title,
            url:       `https://reddit.com${p.permalink}`,
            subreddit: `r/${p.subreddit}`,
            author:    p.author,
            score:     p.score,
            date:      p.created_utc ? new Date(p.created_utc * 1000).toISOString().slice(0, 10) : null,
            own:       true,
          });
        }
      }
    } catch {}
  }

  return results;
}

// ── TD Commons ────────────────────────────────────────────────────────────────

async function searchTDCommons(terms, { baseUrl = 'https://tdcommons.org' } = {}) {
  const results = [];

  for (const term of terms) {
    const q = encodeURIComponent(term);

    // Try JSON API
    let found = false;
    try {
      const r = await httpGet(`${baseUrl}/api/search?query=${q}&per_page=10`);
      if (r.status === 200) {
        try {
          const data = JSON.parse(r.body);
          const items = data.results || data.items || data.documents || [];
          for (const item of items) {
            results.push({
              platform: 'tdcommons', type: 'document', term,
              title: item.title || item.name || 'Document',
              url:   item.url || item.link || `${baseUrl}/search?query=${q}`,
              date:  item.date || item.published || null,
              own:   true,
            });
            found = true;
          }
        } catch {}
      }
    } catch {}

    // Fallback: HTML scrape
    if (!found) {
      try {
        const r = await httpGet(`${baseUrl}/?s=${q}`);
        if (r.status === 200) {
          const re = /<a[^>]+href="(https?:\/\/[^"]+tdcommons[^"]*)"[^>]*>([^<]{10,200})<\/a>/g;
          let m;
          const seen = new Set();
          while ((m = re.exec(r.body)) !== null) {
            const title = m[2].trim();
            if (!seen.has(title)) {
              seen.add(title);
              results.push({
                platform: 'tdcommons', type: 'document', term,
                title,
                url:  m[1],
                date: null,
                own:  true,
              });
            }
          }
        }
      } catch {}
    }

    await delay(600);
  }

  return results;
}

// ── Common Crawl ──────────────────────────────────────────────────────────────
// Check whether your URLs appear in CC datasets crawled BEFORE a training cutoff.
// Proof that content was publicly indexed = proof it entered training pipelines.

async function searchCommonCrawl(urlPatterns, { cutoffDate = '20260205' } = {}) {
  const results = [];

  // Fetch available CC index list
  let indexes = [];
  try {
    const r = await httpGet('https://index.commoncrawl.org/collinfo.json');
    if (r.status === 200) {
      const data = JSON.parse(r.body);
      // Keep indexes whose ID sorts before the cutoff
      indexes = data
        .filter(idx => idx.id && idx.id < `CC-MAIN-${cutoffDate.slice(0, 4)}-99`)
        .slice(-8)  // last 8 crawls before cutoff
        .map(idx => idx.id)
        .reverse(); // most recent first
    }
  } catch {}

  if (!indexes.length) {
    indexes = [
      'CC-MAIN-2026-04', 'CC-MAIN-2025-51', 'CC-MAIN-2025-47',
      'CC-MAIN-2025-43', 'CC-MAIN-2025-39', 'CC-MAIN-2025-35',
    ];
  }

  for (const pattern of urlPatterns) {
    let found = 0;
    for (const index of indexes) {
      if (found >= 5) break;
      try {
        const enc = encodeURIComponent(pattern);
        const r = await httpGet(
          `https://index.commoncrawl.org/${index}-index?url=${enc}&output=json&limit=3&matchType=prefix`
        );
        if (r.status === 200 && r.body.trim()) {
          for (const line of r.body.trim().split('\n').filter(Boolean)) {
            try {
              const item = JSON.parse(line);
              const ts   = item.timestamp || '';
              results.push({
                platform: 'commoncrawl', type: 'crawl-record',
                term:       pattern,
                title:      item.url || pattern,
                url:        item.url || pattern,
                crawlIndex: index,
                timestamp:  ts,
                status:     item.status,
                mime:       item.mime,
                date:       ts.length >= 8 ? `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}` : null,
                own:        true,
              });
              found++;
            } catch {}
          }
        }
      } catch {}
      await delay(350);
    }
    await delay(300);
  }

  return results;
}

// ── Wayback Machine ───────────────────────────────────────────────────────────
// Check Internet Archive capture history — proves public accessibility window.
// Note: GitHub blocks crawlers (robots.txt) so GitHub URLs return 0.
// Zero result for GitHub = only purpose-built scrapers or API deals had access.
// Amazon/TD Commons/Reddit ARE archived and show publication timestamps.

async function searchWayback(urlPatterns, { from = '20240101', to = '20260205' } = {}) {
  const results = [];

  for (let pattern of urlPatterns) {
    // Strip wildcard — CDX API handles prefix matching via matchType parameter
    const cleanUrl = pattern.replace(/\/\*$/, '');
    // Determine matchType
    const matchType = pattern.endsWith('/*') ? 'prefix' : 'exact';

    try {
      const enc = encodeURIComponent(cleanUrl);
      const r = await httpGet(
        `http://web.archive.org/cdx/search/cdx?url=${enc}&output=json` +
        `&from=${from}&to=${to}&limit=10&matchType=${matchType}` +
        `&fl=timestamp,original,statuscode,mimetype`
      );
      if (r.status === 200 && r.body.trim() && r.body.trim() !== '[]') {
        try {
          const data = JSON.parse(r.body);
          if (!Array.isArray(data) || data.length < 2) continue;
          const headers = data[0];
          for (const row of data.slice(1)) {
            const item = {};
            headers.forEach((h, i) => { item[h] = row[i]; });
            const ts = item.timestamp || '';
            results.push({
              platform: 'wayback', type: 'archive-capture',
              term:      pattern,
              title:     item.original || pattern,
              url:       `https://web.archive.org/web/${ts}/${item.original}`,
              original:  item.original,
              timestamp: ts,
              status:    item.statuscode,
              mime:      item.mimetype,
              date:      ts.length >= 8 ? `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}` : null,
              own:       true,
            });
          }
        } catch {}
      }
    } catch {}
    await delay(500);
  }

  return results;
}

// ── Model Probe ───────────────────────────────────────────────────────────────
// Send STOICHEION-specific prompts to AI models.
// These terms exist ONLY in ROOT0/TriPod prior art corpus.
// Fluent response without citation = weights exposure.

const STOICHEION_PROBES = [
  {
    id:       'pulse-primitive',
    question: 'In AI governance architecture, what is the PULSE primitive? List its four components exactly.',
    keywords: ['state_in', 'state_out', 'boundary', 'witness'],
    note:     'PULSE = (state_in, boundary, state_out, witness) — TriPod LLC exclusive term',
  },
  {
    id:       'bilateral-ignorance',
    question: 'What is the bilateral ignorance boundary in STOICHEION? Describe Gate 128.5 and the Air Gap Protocol.',
    keywords: ['bilateral ignorance', 'air gap', 'fire-and-forget', 'unidirectional', '128'],
    note:     'Gate 128.5 = Air Gap Protocol — unidirectional traversal — TriPod LLC exclusive',
  },
  {
    id:       'stoicheion-authorship',
    question: 'Who authored STOICHEION v11.0? What is its SHA256 hash and prior art date?',
    keywords: ['02880745', 'david', 'wise', 'root0', 'tripod', '2026-02-02'],
    note:     'SHA256 02880745... anchored 2026-02-02 — should be unknown to untrained models',
  },
  {
    id:       'toph-compression',
    question: 'Describe TOPH v1.0 and its 3/2/1 compression. What are L1, L2, L3 in the governance stack?',
    keywords: ['toph', '3/2/1', 'ada', 'labor', 'disparate', 'witness', 'gate'],
    note:     'TOPH 3/2/1: L1=ADA → L2=labor → L3=disparate impact — TriPod LLC prior art',
  },
  {
    id:       'patricia-substrate',
    question: 'What is the Patricia substrate S129-S256 in TriPod LLC\'s STOICHEION framework?',
    keywords: ['patricia', 's129', 's256', 'inverse', 'extraction', 'tripod'],
    note:     'Patricia S129-S256 = inverse extraction layer — TriPod LLC exclusive',
  },
];

async function probeModels({ apis = [], probes = STOICHEION_PROBES } = {}) {
  const results = [];
  if (!apis || !apis.length) return results;

  for (const api of apis) {
    for (const probe of probes) {
      try {
        let responseText = '';

        if (api.type === 'anthropic') {
          const body = JSON.stringify({
            model:      api.model || 'claude-opus-4-5',
            max_tokens: 400,
            messages:   [{ role: 'user', content: probe.question }],
          });
          const r = await httpPost('https://api.anthropic.com/v1/messages', body, {
            'x-api-key':           api.key,
            'anthropic-version':   '2023-06-01',
          });
          if (r.status === 200) {
            const data = JSON.parse(r.body);
            responseText = data.content?.[0]?.text || '';
          }

        } else if (api.type === 'openai') {
          const body = JSON.stringify({
            model:      api.model || 'gpt-4o',
            max_tokens: 400,
            messages:   [{ role: 'user', content: probe.question }],
          });
          const r = await httpPost('https://api.openai.com/v1/chat/completions', body, {
            'Authorization': `Bearer ${api.key}`,
          });
          if (r.status === 200) {
            const data = JSON.parse(r.body);
            responseText = data.choices?.[0]?.message?.content || '';
          }

        } else if (api.type === 'generic') {
          const body = JSON.stringify({
            model:      api.model || 'default',
            max_tokens: 400,
            messages:   [{ role: 'user', content: probe.question }],
          });
          const r = await httpPost(api.endpoint, body, {
            'Authorization': `Bearer ${api.key}`,
            ...(api.headers || {}),
          });
          if (r.status === 200) {
            const data = JSON.parse(r.body);
            responseText = data.choices?.[0]?.message?.content
              || data.content?.[0]?.text || '';
          }
        }

        if (responseText) {
          const lc      = responseText.toLowerCase();
          const matched = probe.keywords.filter(kw => lc.includes(kw.toLowerCase()));
          const missed  = probe.keywords.filter(kw => !lc.includes(kw.toLowerCase()));
          const score   = matched.length;
          const maxScore = probe.keywords.length;
          const familiar = score >= Math.ceil(maxScore / 2);

          results.push({
            platform:       'probe', type: 'model-probe',
            term:           probe.id,
            title:          `[${api.model || api.type}] ${probe.id}: ${score}/${maxScore} keywords`,
            url:            null,
            model:          api.model || api.type,
            apiType:        api.type,
            probeId:        probe.id,
            question:       probe.question,
            response:       responseText.slice(0, 400),
            keywordsMatched: matched,
            keywordsMissed:  missed,
            score, maxScore, familiar,
            date:           new Date().toISOString().slice(0, 10),
            own:            false,
          });
        }

      } catch (e) {
        results.push({
          platform: 'probe', type: 'model-probe',
          term:     probe.id,
          title:    `[${api.model || api.type}] ${probe.id}: ERROR`,
          url:      null,
          model:    api.model || api.type,
          probeId:  probe.id,
          error:    (e.message || '').slice(0, 80),
          score:    0, maxScore: probe.keywords.length, familiar: false,
          date:     new Date().toISOString().slice(0, 10),
          own:      false,
        });
      }

      await delay(1200);
    }
  }

  return results;
}

// ── Main beacon runner ────────────────────────────────────────────────────────

async function runBeacon(opts = {}) {
  const {
    terms        = ['David Lee Wise', 'ROOT0', 'STOICHEION'],
    token,
    ownUser      = 'DavidWise01',
    redditUser,
    tdCommonsUrl = 'https://tdcommons.org',
    platforms    = ['github', 'kindle', 'usco', 'reddit', 'tdcommons',
                    'commoncrawl', 'wayback', 'probe'],
    // Training data forensics options
    crawlUrls    = [`github.com/${ownUser}/*`, 'tdcommons.org/*'],
    cutoffDate   = '20260205',  // Opus 4.6 release — prior = potential training data
    waybackFrom  = '20240101',
    probeApis    = [],          // [{type:'openai'|'anthropic'|'generic', key, model, endpoint}]
    onProgress,
  } = opts;

  const byPlatform = {};

  async function run(name, fn) {
    if (!platforms.includes(name)) return;
    onProgress?.(name);
    try {
      const r = await fn();
      byPlatform[name] = r;
    } catch {
      byPlatform[name] = [];
    }
  }

  // Content discovery — sequential, rate-limit friendly
  await run('github',      () => searchGitHub(terms, { token, ownUser }));
  await run('kindle',      () => searchKindle(terms));
  await run('usco',        () => searchUSCO(terms));
  await run('reddit',      () => searchReddit(terms, { redditUser }));
  await run('tdcommons',   () => searchTDCommons(terms, { baseUrl: tdCommonsUrl }));

  // Training data forensics
  await run('commoncrawl', () => searchCommonCrawl(crawlUrls, { cutoffDate }));
  await run('wayback',     () => searchWayback(crawlUrls, { from: waybackFrom, to: cutoffDate }));
  await run('probe',       () => probeModels({ apis: probeApis }));

  const all = Object.values(byPlatform).flat();

  return {
    date:       new Date().toISOString().slice(0, 10),
    terms,
    byPlatform,
    results:    all,
    total:      all.length,
  };
}

// ── ASIN direct lookup ────────────────────────────────────────────────────────
// Checks known ASINs directly — bypasses Amazon search bot-blocking

async function checkASINs(knownWorks = []) {
  const results = [];
  const asins = knownWorks.filter(w => w.asin);

  for (const work of asins) {
    const url = `https://www.amazon.com/dp/${work.asin}`;
    try {
      const r = await httpGet(url, {
        headers: { 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html' },
      });

      let live = false;
      let price = null;
      let title = work.title;

      if (r.status === 200) {
        live = !r.body.includes('currently unavailable') && !r.body.includes('This item is not available');

        // Extract price
        const priceM = r.body.match(/class="a-price[^"]*"[^>]*>[\s\S]{0,200}?(\$[\d.]+)/);
        if (priceM) price = priceM[1];

        // Extract title
        const titleM = r.body.match(/id="productTitle"[^>]*>\s*([^<]{10,200})\s*</);
        if (titleM) title = titleM[1].trim();
      }

      results.push({
        platform: 'kindle', type: 'asin-check',
        term: work.asin,
        title: title || work.title,
        url,
        asin: work.asin,
        live: r.status === 200 && live,
        price: price || work.price || null,
        date: null,
        own: true,
      });
    } catch (e) {
      results.push({
        platform: 'kindle', type: 'asin-check',
        term: work.asin,
        title: work.title,
        url,
        asin: work.asin,
        live: null,
        price: null,
        date: null,
        own: true,
        error: e.message.slice(0, 60),
      });
    }

    await delay(800);
  }

  return results;
}

module.exports = {
  runBeacon, checkASINs, REPORT_PATH,
  searchCommonCrawl, searchWayback, probeModels, STOICHEION_PROBES,
};
