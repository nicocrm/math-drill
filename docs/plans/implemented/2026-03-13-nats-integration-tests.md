# NATS Integration Tests

**Date:** 2026-03-13

## Goal

Add integration tests that exercise `NatsJobStatusStore` against a real NATS JetStream instance, ensuring the adapter works correctly with NATS KV.

## Scope

- Integration tests for `NatsJobStatusStore` in `packages/core`
- Tests run only when explicitly invoked via `npm run test:integration`
- Tests require NATS to be running (e.g. `docker compose up -d nats`)
- Default `npm run test` excludes integration tests so CI/local runs pass without NATS

## Implementation

1. Create `packages/core/src/jobStatus/natsJobStatusStore.integration.test.ts`
   - Test `get` (missing key, existing key)
   - Test `set` and round-trip
   - Test `updateProgress` (new key, existing key with merge)
   - Test `close` and connection cleanup
   - Use unique KV bucket per run to avoid collisions

2. Update `vitest.config.ts` (root) to exclude `**/*.integration.test.ts` from default test run

3. Add `vitest.integration.config.ts` and `test:integration` script to root `package.json`

4. Document in README: run `docker compose up -d nats` before `npm run test:integration`
