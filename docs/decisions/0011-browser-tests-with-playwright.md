# ADR-0011: Browser tests with Playwright in CI

- Status: Proposed
- Date: 2026-11-24

## Context
The PWA spec (`docs/specs/pwa.md`) was verified by hand: Claude drove a headless Chrome before each PR and
Joaquin was to check the rest on the phone. Manual checks are not repeatable and are skipped when in a hurry.
Joaquin asked for browser tests in the pipeline, with two concerns: how long they take and where they run.

## Decision
- **Playwright** (Chromium, Pixel 7 emulation) runs the PWA tests in `e2e/`, one test per requirement id.
- They run against a **test-only Worker** (`e2e/worker.ts` + `e2e/wrangler.jsonc`) that runs the real app and
  plays the role of Cloudflare Access by signing a local token. It has no routes and no workers.dev URL and is never
  deployed; production keeps `src/index.ts` with the real Access verification.
- Each run starts from an empty local database.
- **CI:** a second job in the same workflow, on every push. GitHub-hosted runners (free and unlimited on public
  repos; private repos use the account's monthly allowance). Expected time: about 1–2 minutes, mostly installing
  Chromium; the tests themselves take ~20 s.
- On failure CI keeps the Playwright report and traces as an artifact.

## Consequences
- Every PWA requirement is checked on every push, without Joaquin.
- What a headless browser cannot prove stays manual, once, on the phone: the real install prompt (PWA-01) and
  the real Access session expiry (PWA-08) with the real login.
- The test-only Worker is code that must never be deployed; that is why it lives outside `src/` and has its own
  config.
