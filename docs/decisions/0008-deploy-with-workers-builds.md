# ADR-0008: Deploy with Workers Builds, only through merged PRs

- Status: Proposed
- Date: 2026-11-24

## Context
Claude writes the code, but must never hold Cloudflare credentials, and nothing may reach production without
Joaquin's approval. The first plan used a GitHub Action with a Cloudflare API token stored as a GitHub secret.
Joaquin's personal site already deploys with Workers Builds.

## Decision
- **Workers Builds** (Cloudflare connected to the GitHub repo) deploys on every push to `main`: build command
  `npm run check`, deploy command `npm run deploy` (apply D1 migrations, then `wrangler deploy`).
- `main` only changes through PRs that Joaquin merges; branch protection rules are his.
- GitHub Actions runs CI (typecheck + tests) on **every push to any branch**, without any secret. Claude opens a PR
  only after its branch is green, so a PR never arrives red.
- `workers_dev: false` and `preview_urls: false` in `wrangler.jsonc`: the only public entry is the custom domain
  behind Access (see ADR-0004, Cloudflare Access as the gate, JWT re-checked in the Worker).

## Consequences
- No Cloudflare token exists in GitHub; a compromised repo cannot reach the Cloudflare account through CI.
- Migrations run on every deploy; they must be backward compatible with the previous Worker version during the
  seconds between migration and deploy.
- If the build's own token lacks D1 permission, it is adjusted in the Worker's build settings (one-time).
