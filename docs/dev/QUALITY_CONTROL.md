# Quality Control Proposals

This document catalogs quality control measures proposed for the Aynite project
that are not yet implemented. Each proposal includes rationale, effort estimate,
and a recommended approach.

## 1. GitHub Actions CI

Automate audit and test runs on every push/PR to catch regressions early.

**Pipeline stages:**
- `lint` — Biome check (formatting + lint rules)
- `lint:audit` — ast-grep custom rule scan
- `test` — Vitest unit tests
- `audit:ui` — UI architecture rules
- `audit:main` — Main process architecture rules
- `audit:bridge` — IPC bridge contract verification
- `audit` — Composite audit (runs all audits)

**Effort:** Small — one `.github/workflows/ci.yml` file.

## 2. Pre-commit Hooks

Run lint + audit checks before each commit to prevent bad code from entering
the repo.

**Approach:**
- Add `husky` to manage git hooks
- Add `lint-staged` to run checks only on staged files
- Hook runs `biome check --write` and `tsx scripts/audit-ui.ts --focus=import`

**Trade-off:** Adds friction to committing — offset by catching issues
immediately. Recommend starting with only the fastest checks (Biome lint,
import hierarchy) and adding slower checks (full audit) to CI instead.

**Effort:** Small.

## 3. Dependency Audit

Check for known vulnerabilities in dependencies.

**Approach:**
- Run `npm audit` in CI (built into `npm test` pipeline or as a separate step)
- Use `socket.dev` or `better-npm-audit` for richer reporting
- Optionally add `npm audit` as a pre-publish check

**Effort:** Trivial.

## 4. TypeScript Type Checking (`tsc --noEmit`)

Run the TypeScript compiler in type-check-only mode to catch type errors that
Biome's lint rules might miss.

**Approach:**
```json
{
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```
Then run `npm run typecheck` in CI.

**Current blockers:** The project uses `noEmit: true` already, but may have
type errors that need to be fixed or suppressed before the check can pass
without errors.

**Effort:** Small — the script is one line. Unknown effort to fix existing
type errors.

## 5. Changelog Enforcement

Ensure that every PR includes a changelog entry or is labeled
`skip-changelog`.

**Approach:**
- Use `keep-a-changelog` format in `CHANGELOG.md`
- Add a CI check that verifies a changelog entry exists unless the PR has
  a `skip-changelog` label
- Or use a tool like `changesets` for automated changelog management

**Trade-off:** Adds process overhead but makes release notes trivial.

**Effort:** Medium — tool setup is small, but the cultural habit takes time
to establish.

## Implementation Priority

| # | Proposal | Effort | Impact | Recommended Order |
|---|----------|--------|--------|-------------------|
| 1 | GitHub Actions CI | Small | High | 1st |
| 3 | Dependency audit | Trivial | Medium | 2nd |
| 4 | TypeScript type check | Small | High | 3rd |
| 2 | Pre-commit hooks | Small | Medium | 4th |
| 5 | Changelog enforcement | Medium | Low | 5th |

**Recommendation:** Start with CI and `tsc --noEmit`. Those two give the
highest confidence for the least process overhead. Add pre-commit hooks and
changelog enforcement later if needed.
