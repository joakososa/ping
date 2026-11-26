# CLAUDE.md — ping

Stage-1 proof system and **template repo** for Joaquin's personal systems (Libreta, Mesa, Finanzas…): a
Cloudflare Worker with a D1 database, a private API behind Cloudflare Access, an installable PWA, an audit log,
and (later) an MCP connector for Claude. Throwaway data only.

Cross-system plan and context: Joaquin's context folder `2026 - Migraciones` (`AGENTS.md`, `docs/plan/`).

## 1. How we work (non-negotiable)

**Git and PRs**
- **Never push to `main`. Never.** Every change goes on a branch and reaches `main` only through a PR that
  Joaquin reviews and merges. Merging to `main` deploys (Workers Builds).
- **Small, reviewable PRs:** one concern per PR. If a change grows past what can be reviewed in one sitting, split
  it (stacked PRs are fine: each PR says which one it builds on).
- **Green before the PR:** CI runs on every push to any branch. Claude pushes the branch, waits until CI is green,
  and only then opens the PR, so Joaquin is only notified of PRs that already pass. No draft PRs.

**Specs → tests → code**
1. The behavior is agreed in the chat with Joaquin.
2. Claude writes or updates the **spec** in `docs/specs/` (numbered requirements, e.g. `NOTE-07`: an update with a
   stale version is refused with 409). Joaquin approves.
3. Claude writes the **tests first**, one or more per requirement, with the requirement id in the test name.
   They must fail for the right reason.
4. Then the code, until the tests pass. `npm run check` must pass before opening the PR.
5. Claude records the tests in `docs/tests/<spec>.md`: for each requirement, the tests that cover it (file, test
   name, what it proves). The PR's "Tests" table is taken from there, so the spec → test trace stays versioned.
Commits in a PR follow that order (tests commit, then implementation commit) when practical.

**Mentioning ADRs and specs**
- The first time an ADR or a spec requirement is mentioned in a text (a doc, a PR description, a message to
  Joaquin), write its title or content too: "ADR-0005 (Optimistic concurrency with an integer `version`)",
  "ACC-09 (every `/api` response has `Cache-Control: no-store`)". Later mentions in the same text can use the id.

**Decisions (ADRs)**
- Every important decision is an ADR in `docs/decisions/NNNN-title.md`, written by Claude from what was agreed in
  the chat. Status starts as **Proposed**; Joaquin approves it → **Accepted (date)**.
- **An accepted ADR is never edited**, except to add one line at the top: `Superseded by ADR-NNNN` (or
  `Amended by…`). Changing a decision = a new ADR.
- Every ADR is listed in the index below (§3) with a one-line summary of what it decides.

**PR description** (in Spanish, since it is for Joaquin):
```
## Qué agrega
<the functionality, in a few lines; link the spec / ADRs it implements>

## Tests
| Archivo | Test | Qué prueba |
| --- | --- | --- |
| test/x.test.ts | NOTE-07 refuses a stale version… | <what it proves, in plain words> |

## En qué enfocarse
<where review attention matters most: risky logic, security, decisions taken while coding>

## Fuera de alcance
<what is deliberately left for the next PR>
```

**Other rules**
- Talk to Joaquin in Spanish (rioplatense). Code, comments and `docs/` in English.
- Never put secrets or personal data in this repo (it is public). Emails and AUD tags are Worker secrets.
- **Repo visibility** (decided 2026-11-26): `ping` and `libreta` are public; `mesa`, `finanzas` and `respaldos`
  are private. Test data is always invented, never copied from real data. Public repos have GitHub secret
  scanning and push protection on. **Before making a private repo public, review its whole git history** for
  secrets and personal data: anything ever committed stays in the history, and a public → private switch does not
  undo copies already made.
- Keep `src/core/` generic: it is copied into every system.
- No delete endpoints or tools (soft delete only). No tool that runs free-form SQL.
- `workers_dev` and `preview_urls` stay `false`.
- After changing `wrangler.jsonc`: `npm run types`.

## 2. Docs map

| Path | What |
| --- | --- |
| `docs/specs/` | Behavior specs with numbered requirements; tests are derived from them |
| `docs/tests/` | One file per spec: which tests cover each requirement and what they prove |
| `docs/decisions/` | ADRs (see index below) |
| `docs/api.md` | API contract |
| `docs/db-schema.md` | Database schema and its rules |
| `README.md` | Overview, development commands, one-time setup in Cloudflare |

## 3. ADR index

| ADR | Status | Decides |
| --- | --- | --- |
| [0001](docs/decisions/0001-record-decisions-as-adrs.md) | Proposed | Decisions are recorded as ADRs; accepted ADRs are immutable except for supersede notes |
| [0002](docs/decisions/0002-one-repo-per-system-ping-as-template.md) | Proposed | One repo per system; `ping` is the template; `src/core/` is copied, not shared as a package |
| [0003](docs/decisions/0003-stack.md) | Proposed | Cloudflare Workers + D1, TypeScript, Hono, Vitest in the Workers runtime; plain HTML/JS PWA |
| [0004](docs/decisions/0004-access-gate-and-jwt-recheck.md) | Proposed | Cloudflare Access gates every system; the Worker re-verifies the JWT, checks one allowed email and fails closed |
| [0005](docs/decisions/0005-optimistic-concurrency-with-version.md) | Proposed | Writes carry the integer `version` they read; stale writes get 409, never overwrite |
| [0006](docs/decisions/0006-soft-delete-and-audit-log.md) | Proposed | No hard deletes; every write is audited in `audit_log` in the same transaction |
| [0007](docs/decisions/0007-idempotent-create-with-client-ids.md) | Proposed | Clients generate UUIDs, so offline retries never duplicate |
| [0008](docs/decisions/0008-deploy-with-workers-builds.md) | Proposed | Deploy on merge with Workers Builds; no Cloudflare token in GitHub; workers.dev and previews off |
| [0009](docs/decisions/0009-pwa-refresh-on-focus.md) | Proposed | PWA refreshes on open/focus (not live); cached shell; offline queue for creations |
| [0010](docs/decisions/0010-english-names.md) | Proposed | Code, API, database and docs in English; only the UI text is in Spanish |

## 4. Plan

| # | PR | Status |
| --- | --- | --- |
| 1 | `docs/fundamentos`: this file, ADRs 0001–0010, specs, API contract, DB schema | Open |
| 2 | `feat/acceso`: tooling + CI + Access gate spec (`ACC-*`) + `/api/me` | Open (on top of 1) |
| 3 | `feat/notas`: migration, audit log, notes API and audit spec (`NOTE-*`, `AUD-*`) | Open (on top of 2) |
| 4 | `feat/pwa`: installable PWA, PWA spec (`PWA-*`) | Open (on top of 3) |
| 5 | Setup in Cloudflare (Joaquin, steps in README) + first deploy + checklist | After 1–4 merge and joakososa.dev moves |
| 6 | `feat/mcp`: MCP connector with OAuth through Access | Spec + ADR first |
| 7 | Mark repo as GitHub template | After 6 |

## 5. Commands

```sh
npm ci
npm run check     # typecheck + tests (required before every PR)
npm run types     # regenerate worker-configuration.d.ts after changing wrangler.jsonc
npm run dev       # local server; /api answers 500 locally on purpose (Access not configured)
```
