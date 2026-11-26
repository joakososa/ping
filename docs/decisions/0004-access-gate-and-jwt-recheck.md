# ADR-0004: Cloudflare Access as the gate, JWT re-checked in the Worker

- Status: Accepted (2026-11-26)
- Date: 2026-11-24

## Context
Each system lives at a public subdomain (`<system>.joakososa.dev`) but must be usable only by Joaquin. Access
(Zero Trust Free) authenticates before a request reaches the Worker and adds a signed JWT
(`Cf-Access-Jwt-Assertion`). A misconfiguration (a route outside Access, a workers.dev URL left on) would expose
the Worker directly.

## Decision
- An Access application per system hostname. Policy: Allow, include one email (Joaquin's). Session: 1 month.
  Login method: the Cloudflare identity provider (Cloudflare account with 2FA), the default for new organizations.
- The Worker **verifies the JWT again** on every `/api/*` request: signature against the team's public keys
  (`https://<team>/cdn-cgi/access/certs`), issuer `https://<team>`, audience = the application's AUD tag, and the
  `email` claim equal (case-insensitive) to `ALLOWED_EMAIL`.
- **Fail closed:** if `TEAM_DOMAIN`, `POLICY_AUD` or `ALLOWED_EMAIL` is missing, empty or a placeholder, every API
  request is refused with 500.
- `POLICY_AUD` and `ALLOWED_EMAIL` are Worker secrets (not in the repo). `TEAM_DOMAIN`
  (`joakososa.cloudflareaccess.com`) is a plain variable.
- Every `/api/*` response carries `Cache-Control: no-store`.
- Static assets (the PWA shell) are served without running the Worker; Access still gates them at the edge. They
  contain no data.

## Consequences
- Two independent checks must both fail for data to leak.
- Local `wrangler dev` cannot call the API (500 by design); the API is tested with locally signed tokens.
- The MCP endpoint cannot use the interactive Access login; it needs OAuth with Access as identity provider
  (separate ADR when that PR starts).
