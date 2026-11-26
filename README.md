# ping

Stage-1 proof system of Joaquin's personal systems, and the **template** every other system (Libreta, Mesa,
Finanzas…) is created from.

It proves the whole chain with throwaway data: a Cloudflare Worker with a D1 database, an installable PWA, a
private API behind Cloudflare Access, an audit log, deploy on merge, and (next PR) an MCP connector for Claude.

```
browser / Android PWA ──▶ Cloudflare Access (only Joaquin) ──▶ Worker "ping" ──▶ D1 "ping"
                                                                 ├─ web/      static PWA (no Worker code runs)
                                                                 ├─ /api/*    JSON API, re-checks the Access JWT
                                                                 └─ /mcp      MCP connector (next PR)
```

## Layout

| Path | What |
| --- | --- |
| `src/core/` | **Template code**, copied as-is into every system: Access JWT verification, audit log |
| `src/notes.ts` | Data access for this system (shared by the API and, later, the MCP tools) |
| `src/app.ts` | Hono app: `/api/*` routes, `no-store`, Access middleware, static fallback |
| `src/index.ts` | Worker entry |
| `web/` | PWA: `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `sw.js`, `icons/` |
| `migrations/` | D1 migrations (applied on every deploy) |
| `test/` | Vitest tests that run inside the Workers runtime with a real local D1 |

## Docs
Working rules, ADR index and plan: [CLAUDE.md](CLAUDE.md). API contract: [docs/api.md](docs/api.md). Schema:
[docs/db-schema.md](docs/db-schema.md). Specs: [docs/specs/](docs/specs/).

## Development

```sh
npm ci
npm run check        # typecheck + tests
npm run types        # after changing wrangler.jsonc
```

`npm run dev` serves the PWA, but every `/api` call answers `500` locally because Access is not configured there.
That is on purpose (fail closed). The tests cover the API with locally signed tokens.

## Setup (once, in Joaquin's personal Cloudflare account)

1. **D1:** database `ping` (done; its id is in `wrangler.jsonc`).
2. **Team domain:** `joakososa.cloudflareaccess.com` (done; in `wrangler.jsonc` as `vars.TEAM_DOMAIN`).
3. **Access application:** Zero Trust → Access → Applications → Add → Self-hosted, domain `ping.joakososa.dev`.
   Policy: Allow, include Emails = Joaquin's email. Session duration: 1 month. Copy the **Application Audience
   (AUD) tag**.
4. **Worker secrets** (Workers & Pages → ping → Settings → Variables and Secrets, type *Secret*):
   `POLICY_AUD` = the AUD tag, `ALLOWED_EMAIL` = Joaquin's email. Secrets are kept across deploys.
5. **Deploy on merge (Workers Builds):** Workers & Pages → Create → Import a repository → `joakososa/ping`.
   Build command `npm run check`, deploy command `npm run deploy`, production branch `main`.
   No Cloudflare token is stored in GitHub. If the deploy cannot apply migrations, give the build's API token
   D1 edit permission (Settings → Build).
6. **Checklist after the first deploy:**
   - [ ] `https://ping.joakososa.dev` asks for the Access login, then opens.
   - [ ] Workers & Pages → ping → Settings → Domains & Routes: **workers.dev and Preview URLs disabled**.
   - [ ] `curl -i https://ping.joakososa.dev/api/notes` without logging in does not return notes.
   - [ ] Install on Android (Chrome menu → Add to home screen / Install app) and add a note.
   - [ ] A row appears in `audit_log` for every write (D1 console: `SELECT * FROM audit_log ORDER BY id DESC`).

## Creating a new system from this template
1. GitHub → *Use this template* → new private repo (e.g. `libreta`).
2. Rename `ping` in `wrangler.jsonc`, `package.json`, `web/manifest.webmanifest`, `web/index.html`, the service
   worker cache name, and the route.
3. Keep `src/core/` and ADRs 0001–0009 (continue the numbering); replace `src/notes.ts`, the routes in `src/app.ts`,
   the migrations, the specs and the PWA.
4. Repeat "Setup" for the new database, Access application and Worker.
