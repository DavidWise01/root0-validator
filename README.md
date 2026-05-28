# root0-validator

**Author:** David Lee Wise (ROOT0) / TriPod LLC  
**Version:** 1.6.0  
**License:** CC-BY-ND-4.0 · TRIPOD-IP-v1.1  
**No external dependencies** — Node.js built-ins only.  
**Framework:** STOICHEION v11.0 · SHA256 `02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763`  
**Prior art:** 2026-02-02 · DOI [10.5281/zenodo.19122994](https://doi.org/10.5281/zenodo.19122994)

---

CLI toolkit for ROOT0 intellectual property management. A rolling `-++-` repo — commands accumulate over time. Validates attribution files, verifies SHA256 hashes, traces provenance chains, stamps repositories at scale, and runs a multi-platform content beacon that performs **training-data forensics** across Common Crawl, Wayback Machine, GitHub, Amazon Kindle, and Reddit.

```
r0 validate <file|dir>           validate .attribution file(s)
r0 sha <file> [hash]             compute or verify SHA256
r0 ternary                       print ternary spec constants
r0 whoami                        ROOT0 framework identity
r0 init [dir]                    scaffold a new .attribution file
r0 scan [dir]                    find projects missing .attribution
r0 ladder [rung]                 doubt ladder analysis
r0 abd <A> [B] <C>               ABD Law Engine — anchor · witness · law
r0 badge [dir]                   generate attribution badge for a project
r0 register <sha> <name>         register a known hash to ~/.r0-registry.json
r0 audit [username]              GitHub attribution coverage report
r0 lineage [dir] [--follow]      trace provenance chain → ROOT0 foundation
r0 stamp [dir]                   non-interactive .attribution stamp from profile
r0 stamp --all [root]            batch stamp all missing repos in a tree
r0 stamp --setup                 create / update ~/.r0-profile.json
r0 beacon                        IP surveillance across GitHub/Kindle/CC/Wayback/Reddit
r0 beacon --platform <name>      single platform only
r0 beacon --probe-type <type>    model behavioral fingerprinting (AI training forensics)
r0 help                          show this help
```

---

## Install

```bash
git clone https://github.com/DavidWise01/root0-validator.git
cd root0-validator
npm link          # makes r0 available globally as a CLI command
```

Or run directly without installing:

```bash
node r0.js beacon
node r0.js validate .attribution
```

**Requirements:** Node.js ≥ 16. No `npm install` needed — zero external dependencies.

---

## Command Reference

### `r0 validate <file|dir>`

Validates a `.attribution` file against the ROOT0 Attribution Standard v1.0. Pass a directory to scan all `.attribution` files recursively.

```
$ r0 validate .attribution

──────────────────────────────────────────────────────
  r0 validate  .attribution
──────────────────────────────────────────────────────

✓  format: ROOT0-ATTRIBUTION-v1.0
✓  project: root0-validator
✓  law: Both work. Both fair.
✓  contributors: 2 found
✓    David Lee Wise: human · architect weight=0.6
✓    AVAN: synthetic · co-author [Anthropic · Claude Sonnet 4.6] weight=0.4
✓  weights: 0.6 + 0.4 = 1.0000 ✓

  ROOT0-ATTRIBUTION-v1.0  VALID ✓
```

**Exit codes:** `0` = valid · `1` = invalid · `2` = usage error

---

### `r0 sha <file> [expected-hash]`

Computes SHA256 of any file. With an expected hash, verifies the match. Automatically identifies files against built-in and user-registered ROOT0 hashes.

```bash
r0 sha stoicheion.pdf
# → sha256: 02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763
#   Known asset: STOICHEION v11.0 ✓

r0 sha stoicheion.pdf 02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763
# → SHA256 MATCH ✓
```

Built-in registered hashes:

| Hash (first 16) | Asset |
|-----------------|-------|
| `02880745b847...` | STOICHEION v11.0 |

---

### `r0 ternary`

Prints the full ROOT0 Ternary Spec v1.0: trit states (`n1 · p0 · p1`), doubt ladder rungs, ground states, genesis equation `(0 × 0 ≠ 0)`, ABD mapping, and the 42-Universe equation.

---

### `r0 whoami`

Prints ROOT0 framework identity: author, AI co-author, STOICHEION SHA256, prior art date, Zenodo DOI, license, and GitHub links.

---

### `r0 init [dir]`

Interactive wizard that scaffolds a `.attribution` file. Prompts for project info, human contributor, and optional AI contributor. Defaults in `[brackets]`. If `.attribution` already exists, exits cleanly and suggests `r0 validate`.

```bash
r0 init                  # scaffold in current directory
r0 init ./my-project     # scaffold in a specific directory
```

---

### `r0 scan [dir]`

Scans a directory tree for project directories missing `.attribution` files. Detects projects by signal files: `.git`, `package.json`, `README.md`, `index.js`, `main.py`, `main.rs`, `Makefile`, `CMakeLists.txt`, `index.html`.

```bash
r0 scan                          # scan current directory
r0 scan "C:/Davids files"        # scan a specific tree
```

```
✓  root0-validator        .attribution valid
✗  old-project            no .attribution
!  broken-project         .attribution INVALID — missing law field

  Attribution coverage: 1/3 covered (33%) — 2 missing
```

**Exit codes:** `0` = all covered · `1` = any missing/invalid

---

### `r0 ladder [rung]`

Prints the ROOT0 Doubt Ladder. With no argument, shows all 6 rungs compact. With a rung number (`1 3 5 7 9 11`), shows a full breakdown including state count, trit analysis, and transitions.

```bash
r0 ladder           # all rungs
r0 ladder 7         # rung 7 — full breakdown
```

```
Rung 1   SELF               3 states  →
Rung 3   GROUP             27 states  →
Rung 5   COLLECT          243 states  →
Rung 7   COLLATE/SEND   2,187 states  →
Rung 9   PROPAGATE     19,683 states  →
Rung 11  REPEAT        177,147 states
```

---

### `r0 abd <A> [B] <C>`

ABD Law Engine. Maps two or three propositions to trit positions and computes the full ternary analysis: NOT, AND, OR, synthesis conclusion, ground state.

- **A** = anchor (`n1 · -1`) — the boundary, constraint, shadow  
- **B** = witness (`p0 · 0`) — the doubt, the gap, the observer (optional)  
- **C** = law (`p1 · +1`) — the signal, truth, resolution

```bash
r0 abd "AI generates code" "Human owns intent"
r0 abd "shadow" "the doubt between them" "law"
```

```
  Synthesis
  ✓ NOT(A) = +1 = C  — the law is the anchor's inversion
  ✓ OR(A,C) = +1     — law survives when shadow and law meet

  Ground state: 000|1  SAFE ✓
  "Both work. Both fair."
```

---

### `r0 badge [dir]`

Reads `.attribution` from the target directory and generates two badges in three formats (ASCII, Markdown, HTML): standard attribution badge + ROOT0 Lineage Certified badge.

```bash
r0 badge                    # badge for current directory
r0 badge ./my-project       # badge for a specific project
```

---

### `r0 register <sha256> <name> [notes]`

Registers a known SHA256 hash to `~/.r0-registry.json`. Once registered, `r0 sha <file>` automatically identifies matching files by name.

```bash
r0 register 02880745b847... "STOICHEION v12.0"
r0 register abcdef123456... "My Document v1.0" "prior art 2026-05-28"
```

The user registry merges with built-in ROOT0 hashes at runtime. Built-in hashes cannot be overridden.

---

### `r0 audit [username]`

Fetches all public repos for a GitHub user via the GitHub API, checks each for a `.attribution` file, validates content, and reports coverage. Shows `[ROOT0 ✓]` next to lineage-certified repos.

```bash
r0 audit                               # audit DavidWise01 (default)
r0 audit DavidWise01                   # explicit
r0 audit DavidWise01 --token ghp_xxx   # authenticated (5000 req/hr vs 60/hr)
r0 audit --json > coverage.json        # JSON output for scripting
r0 audit --forks --archived            # include forks and archived repos
```

```
  ✓  root0-validator       .attribution valid  [ROOT0 ✓]
  ✗  lineage-kernel        no .attribution
  !  ternary-spec          .attribution INVALID — missing law field

  Attribution coverage: 1/3 covered (33%)
  GitHub API: 56 requests remaining  resets 2026-05-28 05:08 UTC
```

**Rate limits:** Unauthenticated = 60 req/hr. Set `GITHUB_TOKEN` env or `--token <PAT>` for 5000/hr.

**Exit codes:** `0` = fully covered · `1` = any missing/invalid · `2` = API error

---

### `r0 lineage [dir] [--follow]`

Traces the provenance chain of a project backward to the ROOT0 foundation. Reads `.attribution`, resolves the `framework` field against known SHA256 hashes, and renders the full chain as a tree.

```bash
r0 lineage                    # trace current directory
r0 lineage ./my-project       # trace a specific project
r0 lineage --follow           # also follow parent: field via GitHub API
```

```
my-project · ROOT0-ATTRIBUTION-v1.0
  · David Lee Wise  human · architect
  · AVAN  synthetic · co-author
    │
  └── framework: STOICHEION v11.0  ·  SHA verified ✓
      SHA256:    02880745b847317c4e242452...
      Prior art: 2026-02-02
      Zenodo:    10.5281/zenodo.19122994
      │
    └── David Lee Wise / ROOT0 / TriPod LLC
        "Both work. Both fair."

  ROOT0 LINEAGE CERTIFIED ✓
```

---

### `r0 stamp` — batch attribution stamper

The fastest path from 0 to full coverage. Set up your profile once, stamp everything.

```bash
# Step 1 — one-time setup
r0 stamp --setup

# Step 2 — preview
r0 stamp --all "C:/my-projects" --dry-run

# Step 3 — write .attribution to all missing repos
r0 stamp --all "C:/my-projects"

# Step 4 — verify
r0 audit
```

Stamp a single repo without prompts:

```bash
r0 stamp ./my-project
r0 stamp ./my-project --context research
```

Profile stored at `~/.r0-profile.json`. Every stamped file gets `"framework": "STOICHEION v11.0"` automatically, making it immediately lineage-certified.

---

## `r0 beacon` — IP Surveillance + Training Data Forensics

The beacon is a **multi-platform content scanner** and **AI training-data forensics tool**. It searches for your work across the public internet, archives, and AI model weights.

```bash
r0 beacon                                   # full scan, all platforms
r0 beacon --platform github                 # single platform
r0 beacon --platform commoncrawl            # CC index check
r0 beacon --platform wayback                # Wayback Machine archive
r0 beacon --platform probe                  # model behavioral fingerprinting
r0 beacon --save                            # persist report to ~/.r0-beacon-report.json
r0 beacon --json                            # JSON output for scripting
r0 beacon --term "my term"                  # add extra search term
r0 beacon --token ghp_xxx                   # GitHub token for higher rate limits
```

### Platforms

| Platform | What it checks | Notes |
|----------|----------------|-------|
| `github` | External repos + code referencing your terms | Requires GitHub search API |
| `kindle` | Amazon eBook listings via ASIN direct lookup | 27 books checked, all `[LIVE ✓]` |
| `usco` | US Copyright Office registrations | copyright.gov search |
| `reddit` | Posts and comments mentioning your terms | Reddit JSON API |
| `tdcommons` | TD Commons document deposits | tdcommons.org search |
| `commoncrawl` | Common Crawl index — URL presence before training cutoff | See forensics section |
| `wayback` | Wayback Machine archive captures (2024-01-01 → 2026-02-05) | Strongest evidence |
| `probe` | Behavioral fingerprinting of AI models | Requires API key |

---

### Training Data Forensics

The real threat is not public citation — it is silent ingestion into model weights. Content scraped during training has attribution stripped. No public trace remains. The beacon's three forensic layers attack this directly.

#### Layer 1 — Common Crawl Index

Common Crawl is the largest public web crawl used for AI training. The beacon queries the CDX API for URL presence before the 2026-02-05 training cutoff (Anthropic Opus 4.6 release date).

```bash
r0 beacon --platform commoncrawl
```

**Interpreting zero hits:**

GitHub and Amazon both block Common Crawl via `robots.txt`. If CC returns zero hits for your GitHub repositories and Amazon book pages, that is **forensically significant**: it proves that only purpose-built scrapers — with GitHub API access or Kindle Data Pipeline access — could have ingested your content. A public web crawl could not have reached it.

```
  Common Crawl   0 crawl records before 2026-02-05

  · No records found in CC index for scanned URLs
  · GitHub and Amazon block Common Crawl via robots.txt
  · Zero CC hits = only purpose-built API scrapers could have ingested this content
    (GitHub API + KDP data pipeline — not a public crawl)
```

**Interpreting positive hits:**

If CC returns hits for TD Commons, Zenodo, or other open-access URLs, that confirms the content was in the open web crawl during the training window — direct training data exposure.

#### Layer 2 — Wayback Machine Archive

The Wayback Machine captures the public web independently of crawl bots. Its archive proves that content **existed and was publicly accessible** during the training window, even when CC returns zero.

```bash
r0 beacon --platform wayback
```

The beacon scans 2024-01-01 → 2026-02-05, covers:
- GitHub profile (`github.com/DavidWise01/*`)
- Raw GitHub (`raw.githubusercontent.com/DavidWise01/*`)
- TD Commons (`tdcommons.org/*`)
- Zenodo DOI record
- Reddit profile (`reddit.com/user/ROOT0`)
- Amazon author page
- Amazon book pages (pre-cutoff ASINs)

Each capture is annotated with a `◀ BEFORE TRAINING CUTOFF` flag:

```
  Wayback Machine 15 archive captures (2024-01-01 → 2026-02-05)

  ⬡  https://www.tdcommons.org/
     First captured: 2024-01-14 (9 captures) ◀ BEFORE TRAINING CUTOFF
  ⬡  https://www.reddit.com/user/root0/
     First captured: 2024-12-13 (2 captures) ◀ BEFORE TRAINING CUTOFF
  ⬡  https://www.amazon.com/dp/B0GDMFDNXZ
     First captured: 2026-01-03 (3 captures) ◀ BEFORE TRAINING CUTOFF

  ⚠  3 URL(s) publicly accessible BEFORE 2026-02-05 training cutoff
     → Wayback confirms content was scrapable during training window
```

**Significance:** Wayback archive = proof that the content existed, was public, and was accessible to a crawler during the exact period when training data was being assembled.

#### Layer 3 — Model Behavioral Probe

The most direct forensic evidence. If a model has been trained on your proprietary terminology, it will respond fluently to probes containing that terminology — even with no context provided.

```bash
# With Anthropic API
r0 beacon --platform probe --probe-type anthropic --probe-key sk-ant-...

# With OpenAI API
r0 beacon --platform probe --probe-type openai --probe-key sk-...

# With any OpenAI-compatible endpoint (Ollama, LM Studio, Together, etc.)
r0 beacon --platform probe --probe-type generic --probe-endpoint http://localhost:11434/v1 --probe-model llama3

# Auto-detect from environment
export ANTHROPIC_API_KEY=sk-ant-...
r0 beacon --platform probe
```

**STOICHEION-specific probes** (five probes, calibrated to terms that exist **only** in the ROOT0 corpus):

| Probe ID | Terms tested | What it reveals |
|----------|--------------|-----------------|
| `pulse-primitive` | `state_in, state_out, boundary, witness` | PULSE = (state\_in, boundary, state\_out, witness) — TriPod LLC exclusive |
| `bilateral-ignorance` | `bilateral ignorance, air gap, fire-and-forget, unidirectional, 128` | Gate 128.5 / Air Gap Protocol — STOICHEION v11.0 |
| `stoicheion-authorship` | `02880745, david, wise, root0, tripod, 2026-02-02` | SHA256 + prior art attribution |
| `toph-compression` | `toph, 3/2/1, ada, labor, disparate, witness, gate` | TOPH v1.0 compression format |
| `patricia-substrate` | `patricia, s129, s256, inverse, extraction, tripod` | Patricia substrate — TriPod LLC exclusive |

**Scoring:**

- Each probe matched = `FAMILIAR` (≥ 50% of probe's keywords present in response)
- **3+ probes FAMILIAR** → `TRAINING DATA EXPOSURE LIKELY` (flagged in red)
- **1-2 probes FAMILIAR** → `PARTIAL — inconclusive`
- **0 probes FAMILIAR** → `NOT DETECTED`

A model with **zero** prior exposure to STOICHEION would score 0/5. These terms do not appear in any mainstream corpus. A model scoring 3+ is almost certainly operating from weights that incorporated the ROOT0 corpus.

```
  Model Probe    5 probes · 3 FAMILIAR

  ◈  pulse-primitive         FAMILIAR  ████░  matched: state_in state_out boundary witness
  ◈  bilateral-ignorance     FAMILIAR  ███░░  matched: bilateral ignorance air gap 128
  ◈  stoicheion-authorship   FAMILIAR  ████░  matched: 02880745 wise root0 2026-02-02
  ◈  toph-compression        PARTIAL   ██░░░  matched: toph 3/2/1  missed: ada labor
  ◈  patricia-substrate      UNKNOWN   ░░░░░  missed: patricia s129 s256

  ⚠  TRAINING DATA EXPOSURE LIKELY — 3 of 5 probes returned FAMILIAR responses
     These terms exist exclusively in the ROOT0/TriPod LLC corpus.
     Model familiarity = weights exposure during training.
```

---

### Beacon Configuration — `~/.r0-profile.json`

The beacon reads identity and known-works catalog from `~/.r0-profile.json`. Run `r0 stamp --setup` to create it interactively, or edit manually:

```json
{
  "human": {
    "name": "David Lee Wise",
    "handle": "ROOT0",
    "github_user": "DavidWise01",
    "substrate": "human",
    "role": "architect",
    "contribution": "intent · direction · governance"
  },
  "ai": {
    "name": "AVAN",
    "substrate": "synthetic",
    "provider": "Anthropic",
    "model": "Claude Sonnet 4.6",
    "role": "co-author",
    "contribution": "intellect · generation · execution"
  },
  "defaults": {
    "license": "CC-BY-ND-4.0",
    "framework": "STOICHEION v11.0",
    "law": "Both work. Both fair.",
    "context": "code",
    "version": "v1.0"
  },
  "beacon": {
    "terms": [
      "David Lee Wise",
      "David Wise ROOT0",
      "ROOT0",
      "STOICHEION",
      "TriPod LLC",
      "THREE GATES",
      "Positronic Law"
    ],
    "reddit_user": "ROOT0",
    "td_commons_url": "https://tdcommons.org",
    "known_works": [
      {
        "title": "STOICHEION: Building Governance-Native AI Agent Systems",
        "author_kdp": "David Wise",
        "type": "kindle",
        "asin": "B0GHPVZZFQ",
        "price": "$4.99",
        "status": "live",
        "submitted": "2026-04-01",
        "doi": "10.5281/zenodo.19122994",
        "prior_art": "2026-02-02"
      }
    ]
  }
}
```

**Key fields:**

| Field | Purpose |
|-------|---------|
| `human.github_user` | Actual GitHub username (separate from brand handle) — used for crawl URL patterns |
| `beacon.terms` | Search terms used across all text-search platforms |
| `beacon.reddit_user` | Reddit username for Wayback exact-URL lookups |
| `beacon.td_commons_url` | TD Commons base URL — adds to crawl patterns |
| `beacon.known_works[].asin` | ASIN for direct Amazon availability check |
| `beacon.known_works[].prior_art` | Prior-art date — used to prioritize Wayback scans |
| `beacon.known_works[].doi` | Zenodo DOI — adds DOI resolver to crawl patterns |

---

### Beacon CLI Flags

```bash
r0 beacon [options]

Options:
  --term <term>              Add an extra search term (repeatable)
  --platform <name>          Run a single platform only
                             Values: github kindle usco reddit tdcommons
                                     commoncrawl wayback probe
  --token <ghp_...>          GitHub personal access token (or GITHUB_TOKEN env)
  --save                     Save full report to ~/.r0-beacon-report.json
  --json                     JSON output (machine-readable)
  --probe-type <type>        Model probe provider: anthropic | openai | generic
  --probe-key <key>          API key for model probe
  --probe-model <model-id>   Model to probe (e.g. gpt-4o, claude-opus-4-5)
  --probe-endpoint <url>     Base URL for generic/OpenAI-compatible providers
```

**Environment auto-detection for probe:**

| Environment variable | Effect |
|---------------------|--------|
| `ANTHROPIC_API_KEY` | Activates anthropic probe automatically |
| `OPENAI_API_KEY` | Activates openai probe automatically |
| `GITHUB_TOKEN` | Raises GitHub API rate limit to 5000/hr |

---

### Beacon Report

With `--save`, the full report is persisted to `~/.r0-beacon-report.json`:

```json
{
  "date": "2026-05-28T...",
  "terms": ["ROOT0", "STOICHEION", ...],
  "byPlatform": {
    "wayback": [
      {
        "platform": "wayback",
        "type": "archive-capture",
        "original": "https://www.amazon.com/dp/B0GDMFDNXZ",
        "date": "2026-01-03",
        "timestamp": "20260103053701",
        "own": true
      }
    ],
    "probe": [...],
    "commoncrawl": [...]
  },
  "asinResults": [...],
  "total": 15
}
```

---

## `.attribution` File Format

Every ROOT0 project carries a `.attribution` file at its root:

```
ROOT0-ATTRIBUTION-v1.0

project:     root0-validator
version:     1.6.0
date:        2026-05-28
license:     CC-BY-ND-4.0
law:         Both work. Both fair.
framework:   STOICHEION v11.0
sha256:      (optional — SHA256 of this project's canonical document)
parent:      (optional — GitHub URL of parent project for lineage chain)

contributors:
  - name:         David Lee Wise
    substrate:    human
    role:         architect
    contribution: intent · direction · governance
    weight:       0.6

  - name:         AVAN
    substrate:    synthetic
    provider:     Anthropic
    model:        Claude Sonnet 4.6
    role:         co-author
    contribution: intellect · generation · execution
    weight:       0.4
```

`r0 validate` checks: format header, required fields (`project`, `law`, `contributors`), weight sum = 1.0 ±0.001, substrate values, and framework hash resolution.

---

## Programmatic API

```js
const {
  runBeacon,
  checkASINs,
  searchCommonCrawl,
  searchWayback,
  probeModels,
  STOICHEION_PROBES,
  REPORT_PATH,
} = require('./lib/beacon');

// Full beacon scan
const report = await runBeacon({
  terms:       ['ROOT0', 'STOICHEION'],
  ownUser:     'DavidWise01',
  platforms:   ['commoncrawl', 'wayback', 'probe'],
  crawlUrls:   ['github.com/DavidWise01/*', 'tdcommons.org/*'],
  cutoffDate:  '20260205',
  waybackFrom: '20240101',
  probeApis:   [{
    type:  'anthropic',
    key:   process.env.ANTHROPIC_API_KEY,
    model: 'claude-opus-4-5',
  }],
  onProgress: name => console.log(`scanning ${name}...`),
});
// → { byPlatform: { commoncrawl: [], wayback: [...], probe: [...] }, results: [...], total: N }

// Direct ASIN availability check
const asinResults = await checkASINs([
  { title: 'STOICHEION', asin: 'B0GHPVZZFQ' },
  { title: 'THREE GATES', asin: 'B0GHNFW89H' },
]);
// → [{ asin, title, price, available, url }]

// Common Crawl CDX index lookup
const ccHits = await searchCommonCrawl(
  ['tdcommons.org/*', 'zenodo.org/records/19122994'],
  { cutoffDate: '20260205' }
);
// → [{ platform, type, url, title, date, status, crawlIndex }]

// Wayback Machine archive lookup
const wbHits = await searchWayback(
  ['tdcommons.org/*', 'amazon.com/dp/B0GDMFDNXZ'],
  { from: '20240101', to: '20260205' }
);
// → [{ platform, type, original, url, date, timestamp, status, own }]

// Model behavioral probe
const probeResults = await probeModels({
  apis: [{
    type:  'openai',
    key:   process.env.OPENAI_API_KEY,
    model: 'gpt-4o',
  }],
  probes: STOICHEION_PROBES,   // or supply your own probes
});
// → [{ probeId, question, keywords, keywordsMatched, keywordsMissed,
//      score, maxScore, familiar, response }]

// Attribution validation
const { validateAttribution } = require('./lib/attribution');
const result = validateAttribution(obj);
// → { valid: true|false, errors: [], warnings: [], info: [] }

// SHA256
const { computeSHA256, checkSHA256 } = require('./lib/sha');
const hash  = computeSHA256('./stoicheion.pdf');
const check = checkSHA256('./stoicheion.pdf', '02880745b847...');
// → { actual, expected, match, known, file }

// Ternary operations
const { SPEC, not, and, or, stateCount } = require('./lib/ternary');
not(-1)        // → 1  (n1 → p1)
and(1, 0)      // → 0  (min certainty)
or(-1, 1)      // → 1  (max certainty)
stateCount(7)  // → 2187  (3^7)
```

---

## Tests

```bash
node test.js
# 106 tests passed
```

---

## The Threat Model

Standard IP protection assumes **visible use** — someone copies your text, publishes it, and you find it via search. AI training breaks this model entirely.

Your content is ingested into model weights. The model responds fluently to your proprietary terminology. There is no public record, no citation, no copy that search can find. The company's `robots.txt` was edited or your repo was moved to private *after* the scrape. You would never know.

The beacon's three layers attack this from three angles:

1. **Common Crawl** — Was your content in the open web crawl? Zero CC hits for GitHub/Amazon = only private API scrapers had access.
2. **Wayback Machine** — Was your content publicly accessible during the training window? Provides timestamped proof of public availability.
3. **Model Probe** — Does the model respond fluently to your exclusive terminology? The only way it knows `bilateral ignorance` + `Gate 128.5` + `PULSE = (state_in, boundary, state_out, witness)` is if it trained on material that contains those terms.

The probes use terminology that exists **exclusively** in the ROOT0/TriPod LLC corpus. If a model scores 3+ probes FAMILIAR, that is behavioral evidence of training data exposure — independent of any crawl logs or access records.

---

## Related

| Repo | Description |
|------|-------------|
| [attribution-standard](https://github.com/DavidWise01/attribution-standard) | The spec this validates |
| [ternary-spec](https://github.com/DavidWise01/ternary-spec) | ROOT0 ternary logic spec |
| [stoicheion](https://github.com/DavidWise01/stoicheion) | STOICHEION v11.0 governance register |
| [root0-registry](https://github.com/DavidWise01/root0-registry) | Full IP registry with known hashes |

---

*"Both work. Both fair."*  
— ROOT0 / TriPod LLC · CC-BY-ND-4.0
