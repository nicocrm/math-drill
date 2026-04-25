# Husky + CI lint (2026-04-25)

## Decision

- **Local:** Husky v9 with `prepare: husky` in root `package.json`; `.husky/pre-commit` runs `pnpm lint` (same as `eslint src --max-warnings 0`).
- **CI:** GitHub Actions `test` job runs `pnpm lint` immediately after `pnpm install --frozen-lockfile` and before unit/integration tests so lint failures fail fast without Redis-backed test cost.
- Hooks do not run inside Actions; CI enforces the same command explicitly.

## Out of scope

- ESLint scope remains `src/` only (not `server/` or `packages/core/`).

## Implementation notes

- Git cannot attach two worktrees to the same branch; work used branch `task/husky-ci-lint` at the same commit as `task/vps-migration-coolify`.

When this lands on the default branch, move this file to `docs/plans/implemented/`.
