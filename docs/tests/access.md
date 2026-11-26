# Tests: Access gate (`ACC`)

Spec: `docs/specs/access.md` (Access gate). File: `test/access.test.ts`. Helpers: `test/helpers.ts` simulates a
local Access team (signs test tokens with a local key) and calls the app with them.

| Requirement | Test | What it proves |
| --- | --- | --- |
| ACC-01: no `Cf-Access-Jwt-Assertion` header → 401 | `ACC-01 refuses a request without the Access header` | A request that did not go through Access gets nothing |
| ACC-02: token signed by a key outside the team's key set → 401 | `ACC-02 refuses a token signed by a key outside the team's key set` | A forged token is rejected |
| ACC-03: audience is not `POLICY_AUD` → 401 | `ACC-03 refuses a token for another Access application` | A token for another app of the same team does not open this one |
| ACC-04: issuer is not the team → 401 | `ACC-04 refuses a token from another team` | A token from another Cloudflare team is rejected |
| ACC-05: expired token → 401 | `ACC-05 refuses an expired token` | Old tokens stop working |
| ACC-06: valid token, email not allowed → 403 | `ACC-06 refuses a valid token for an email that is not allowed` | Only Joaquin's email gets in, even if the Access policy were widened by mistake |
| ACC-07: email compared ignoring case and spaces | `ACC-07 compares the email ignoring case and surrounding spaces` | `Joaquin@…` and `joaquin@…` are the same person |
| ACC-08: missing/empty/placeholder config → 500 | `ACC-08 fails closed with 500 when …` (4 cases: `POLICY_AUD` empty, `ALLOWED_EMAIL` missing, `TEAM_DOMAIN` placeholder, `TEAM_DOMAIN` blank) | A setup mistake locks everyone out instead of letting everyone in |
| ACC-09: every `/api` response is `no-store` | `ACC-09 marks every /api response no-store, including errors` | Success, 401, 403 and 404 responses are never cached |
| ACC-10: `GET /api/me` → `{ email }` | `ACC-10 /api/me returns the allowed email in lower case` | The app can show who is logged in |
| ACC-11: unknown `/api` route → 404 | `ACC-11 answers 404 for an unknown /api route` | Unknown routes answer JSON 404, not the PWA's HTML |
| ACC-12: errors are `{ error }`, no token contents | `ACC-12 error bodies are JSON { error } and do not echo the token` | Errors leak neither the token nor the rejected email |
