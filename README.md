# root0-validator

**Author:** David Lee Wise (ROOT0) / TriPod LLC  
**Version:** 1.0.0  
**License:** CC-BY-ND-4.0 · TRIPOD-IP-v1.1  
**No dependencies** — Node.js built-ins only.

CLI validation toolkit for ROOT0 intellectual property standards.

```
r0 validate .attribution       → pass/fail with field-by-field report
r0 sha <file> [expected-hash]  → compute or verify SHA256
r0 ternary                     → print ternary spec constants
r0 whoami                      → ROOT0 framework identity
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
const { validateAttribution, computeSHA256, TERNARY_SPEC, trit, ladder } = require('root0-validator');

// Validate an attribution object
const result = validateAttribution(obj);
// → { valid: true|false, errors: [], warnings: [], info: [] }

// Compute SHA256
const hash = computeSHA256('./stoicheion.pdf');

// Ternary operations
const { not, and, or } = trit;
not(-1)       // → 1  (n1 → p1)
and(1, 0)     // → 0  (min certainty)
or(-1, 1)     // → 1  (max certainty)

// Doubt ladder
ladder.stateCount(7)   // → 2187  (3^7)
ladder.resolve([0,0,0,1])  // → { result: '000|1', safe: true }
ladder.resolve([0,0,0,0])  // → { result: '00 00', safe: false }
```

---

## Tests

```bash
node test.js
# 23 tests passed
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
