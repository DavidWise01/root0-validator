# root0-validator

**Author:** David Lee Wise (ROOT0) / TriPod LLC  
**Version:** 1.3.0  
**License:** CC-BY-ND-4.0 · TRIPOD-IP-v1.1  
**No dependencies** — Node.js built-ins only.

CLI validation toolkit for ROOT0 intellectual property standards. A rolling `-++-` repo — commands accumulate over time.

```
r0 validate .attribution       → pass/fail with field-by-field report
r0 sha <file> [expected-hash]  → compute or verify SHA256
r0 ternary                     → print ternary spec constants
r0 whoami                      → ROOT0 framework identity
r0 init [dir]                  → scaffold a new .attribution file
r0 scan [dir]                  → find projects missing .attribution
r0 ladder [rung]               → doubt ladder analysis
r0 abd <A> [B] <C>             → ABD Law Engine — anchor · witness · law
r0 badge [dir]                 → generate attribution badge for a project
r0 register <sha> <name>       → register a known hash to ~/.r0-registry.json
r0 audit [username]            → GitHub attribution coverage report
```

---

## Install

```bash
git clone https://github.com/DavidWise01/root0-validator.git
cd root0-validator
npm link          # makes r0 available globally
```

Or run directly without installing:

```bash
node r0.js validate .attribution
node r0.js ternary
```

---

## Commands

### `r0 validate <file|dir>`

Validates a `.attribution` file against the ROOT0 Attribution Standard v1.0.

```
$ r0 validate .attribution

──────────────────────────────────────────────────────
  r0 validate  .attribution
──────────────────────────────────────────────────────

✓  format: ROOT0-ATTRIBUTION-v1.0
✓  project: lineage-kernel
✓  law: Both work. Both fair.
✓  contributors: 2 found
✓    David Lee Wise: human · architect weight=0.6
✓    AVAN: synthetic · co-author [Anthropic · Claude Sonnet 4.6] weight=0.4
✓  weights: 0.6 + 0.4 = 1.0000 ✓

  ROOT0-ATTRIBUTION-v1.0  VALID ✓
```

Pass a directory to scan all `.attribution` files recursively:

```bash
r0 validate ./my-project
```

**Exit codes:** `0` = valid · `1` = invalid · `2` = usage error

---

### `r0 sha <file> [expected-hash]`

Computes SHA256 of any file. If an expected hash is provided, verifies the match. Automatically identifies known ROOT0 assets.

```bash
r0 sha stoicheion.pdf
# → computes hash, identifies as STOICHEION v11.0 if it matches

r0 sha stoicheion.pdf 02880745b847317c4e2424524ec25d0f7a2b84368d184586f45b54af9fcab763
# → SHA256 MATCH ✓
```

Known ROOT0 hashes are built in. Currently registered:

| Hash (first 16) | Asset |
|-----------------|-------|
| `02880745b847...` | STOICHEION v11.0 |

---

### `r0 ternary`

Prints the full ROOT0 Ternary Spec v1.0 — trit states, doubt ladder rungs, ground states, genesis equation, ABD mapping, 42-Universe equation.

```bash
r0 ternary
```

---

### `r0 whoami`

Prints ROOT0 framework identity — author, STOICHEION SHA256, prior art date, Zenodo DOI, license, GitHub, index site.

---

## Programmatic API

```js
const { validateAttribution }              = require('./lib/attribution');
const { computeSHA256, checkSHA256 }       = require('./lib/sha');
const { SPEC, not, and, or, resolve, stateCount } = require('./lib/ternary');
const { scanDir, hasAttribution }          = require('./lib/scan');
const { runInit }                          = require('./lib/init');

// Validate an attribution object
const result = validateAttribution(obj);
// → { valid: true|false, errors: [], warnings: [], info: [] }

// Compute / verify SHA256
const hash = computeSHA256('./stoicheion.pdf');
const check = checkSHA256('./stoicheion.pdf', '02880745b847...');
// → { actual, expected, match, known, file }

// Ternary operations
not(-1)       // → 1  (n1 → p1)
and(1, 0)     // → 0  (min certainty)
or(-1, 1)     // → 1  (max certainty)

// Doubt ladder
stateCount(7)          // → 2187  (3^7)
resolve([0, 0, 0, 1])  // → { result: '000|1', safe: true }
resolve([0, 0, 0, 0])  // → { result: '00 00', safe: false }

// Scan
const projects = scanDir('./my-root', 0, 3);
// → [{ dir, name, found, valid, errors, filePath }]

const attr = hasAttribution('./my-project');
// → { found: true, valid: true, errors: [], filePath: '...' }
```

---

---

### `r0 init [dir]`

Interactive wizard that scaffolds a `.attribution` file in the target directory (defaults to current directory). Prompts for project info, human contributor, and optional AI contributor. Press Enter to accept defaults shown in `[brackets]`.

```bash
r0 init                  # scaffold in current directory
r0 init ./my-project     # scaffold in a specific directory
```

If `.attribution` already exists, the wizard exits cleanly and tells you to run `r0 validate` instead.

---

### `r0 scan [dir]`

Scans a directory tree for project directories that are missing `.attribution` files. Detects projects by the presence of signal files: `.git`, `package.json`, `README.md`, `index.html`, `index.js`, `main.py`, `main.rs`, `Makefile`, `CMakeLists.txt`.

```bash
r0 scan                          # scan current directory
r0 scan "C:/Davids files"        # scan a specific tree
```

Output:
```
✓  my-project                  .attribution valid
✗  old-project                 no .attribution
!  broken-project              .attribution INVALID — missing law field

  Attribution coverage: 1/3 covered (33%) — 1 missing
```

**Exit codes:** `0` = all covered · `1` = any missing/invalid

---

### `r0 ladder [rung]`

Prints ROOT0 Doubt Ladder analysis. With no argument, shows all 6 rungs in a compact summary. With a rung number (`1 3 5 7 9 11`), shows a full breakdown including state count, trit analysis, progression, and transitions.

```bash
r0 ladder           # all rungs — compact
r0 ladder 7         # rung 7 — full analysis
```

```
Rung 1   SELF             3 states  →
Rung 3   GROUP           27 states  →
Rung 5   COLLECT        243 states  →
Rung 7   COLLATE/SEND  2,187 states  →
Rung 9   PROPAGATE    19,683 states  →
Rung 11  REPEAT      177,147 states
```

---

---

### `r0 abd <A> [B] <C>`

ABD Law Engine. Maps two (or three) propositions to trit positions and computes the full ternary analysis.

- **A** = anchor (`n1 · -1`) — the boundary, constraint, shadow
- **B** = witness (`p0 · 0`) — the doubt, the gap, the observer (optional)
- **C** = law (`p1 · +1`) — the signal, truth, resolution

```bash
r0 abd "AI generates code" "Human owns intent"
r0 abd "shadow" "the doubt between them" "law"
```

Output includes all trit operations (`NOT`, `AND`, `OR`) and a synthesis conclusion:
```
  Synthesis
  ✓ NOT(A) = +1 = C  — the law is the anchor's inversion
  ✓ OR(A,C) = +1     — law survives when shadow and law meet

  Ground state: 000|1  SAFE ✓
  "Both work. Both fair."
```

---

### `r0 badge [dir]`

Reads `.attribution` from the target directory (defaults to current) and generates a shields.io badge in three formats: ASCII, Markdown, and HTML.

```bash
r0 badge                    # badge for current directory
r0 badge ./my-project       # badge for a specific project
```

Output:
```
  ASCII badge
  [ ROOT0 · Attribution v1.0 · ✓ ]

  Markdown
  [![ROOT0 Attribution v1.0](https://img.shields.io/badge/...)](...)

  HTML
  <a href="..."><img src="..." alt="..."></a>
```

---

### `r0 register <sha256> <name> [notes]`

Registers a known SHA256 hash to `~/.r0-registry.json`. Once registered, `r0 sha <file>` automatically identifies matching files by name.

```bash
r0 register 02880745b847... "STOICHEION v12.0"
r0 register 02880745b847... "My Document v1.0" "prior art 2026-05-27"
```

The user registry is merged with built-in ROOT0 hashes at runtime. Built-in hashes (STOICHEION etc.) cannot be overridden.

---

---

### `r0 audit [username]`

Fetches all public repos for a GitHub user via the GitHub API, checks each for a `.attribution` file, downloads and validates the content, and reports coverage.

```bash
r0 audit                          # audit DavidWise01 (default)
r0 audit DavidWise01              # same
r0 audit DavidWise01 --token ghp_xxx   # authenticated (5000 req/hr vs 60/hr)
r0 audit --json > coverage.json   # JSON output for scripting
r0 audit --forks --archived       # include forks and archived repos
```

```
  ✓  root0-validator          .attribution valid (root0-validator)
  ✗  lineage-kernel           no .attribution
  !  ternary-spec             .attribution INVALID — missing law field

  Attribution coverage: 1/60 covered (1%) — 59 missing, 0 invalid
  GitHub API: 56 requests remaining  resets 2026-05-28 05:08:16 UTC
```

**Rate limits:** Unauthenticated requests allow 60/hr from your IP — enough for ~58 repos. For larger orgs or frequent runs, set `GITHUB_TOKEN` or pass `--token <PAT>`.

**Exit codes:** `0` = fully covered · `1` = any missing/invalid · `2` = API/usage error

---

## Tests

```bash
node test.js
# 66 tests passed
```

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
