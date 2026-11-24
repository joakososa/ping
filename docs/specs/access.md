# Spec: Access gate (`ACC`)

- Status: Proposed
- Implements: ADR-0004
- Tests: `test/access.test.ts`

Applies to every request under `/api/*`. "Valid token" = a JWT in the `Cf-Access-Jwt-Assertion` header, signed
by a key of the team's key set, issuer `https://<TEAM_DOMAIN>`, audience `POLICY_AUD`, not expired.

| Id | Requirement |
| --- | --- |
| ACC-01 | A request without the `Cf-Access-Jwt-Assertion` header is refused with **401**. |
| ACC-02 | A token signed by a key that is not in the team's key set is refused with **401**. |
| ACC-03 | A token whose audience is not `POLICY_AUD` (another Access application) is refused with **401**. |
| ACC-04 | A token whose issuer is not `https://<TEAM_DOMAIN>` (another team) is refused with **401**. |
| ACC-05 | An expired token is refused with **401**. |
| ACC-06 | A valid token whose `email` is not `ALLOWED_EMAIL` is refused with **403**. |
| ACC-07 | The email comparison ignores letter case and surrounding spaces. |
| ACC-08 | **Fail closed:** if `TEAM_DOMAIN`, `POLICY_AUD` or `ALLOWED_EMAIL` is missing, empty or still a placeholder (`CHANGE-ME`), every request is refused with **500**, whatever the token. |
| ACC-09 | Every `/api/*` response, including errors, has `Cache-Control: no-store`. |
| ACC-10 | `GET /api/yo` with a valid token answers **200** `{ "email": "<allowed email, lower case>" }`. |
| ACC-11 | An unknown `/api/*` route with a valid token answers **404** `{ "error": … }`. |
| ACC-12 | Error bodies are JSON `{ "error": "<message>" }` and never include token contents. |
