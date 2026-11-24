# API contract

Base: `https://ping.joakososa.dev/api`. Behind Cloudflare Access; every request needs the Access session (the
browser sends it automatically; Access adds `Cf-Access-Jwt-Assertion`). JSON in and out.
All responses: `Cache-Control: no-store`. Errors: `{ "error": string }` (plus `actual` on 409).

## Types

```ts
type Nota = {
  id: string;            // UUID
  texto: string;         // 1..2000 chars, trimmed
  creado: string;        // ISO 8601 UTC
  actualizado: string;   // ISO 8601 UTC
  version: number;       // starts at 1, +1 on every update
  borradoEn: string | null;
};
```

## Endpoints

### `GET /api/yo`
→ `200 { "email": string }`

### `GET /api/notas`
→ `200 Nota[]` visible notes, newest first.

### `POST /api/notas`
Body: `{ "id"?: string /* UUID */, "texto": string }`
- `201 Nota` created
- `200 Nota` same `id` and `texto` already existed (safe retry)
- `400` invalid input · `409` the `id` exists with another text

### `PATCH /api/notas/:id`
Body: `{ "version": number, "texto"?: string, "borrar"?: true }` (at least one of `texto`, `borrar`)
- `200 Nota` updated (or soft-deleted: `borradoEn` set)
- `400` invalid input · `404` unknown or deleted · `409 { error, actual: Nota }` stale `version`

## Status codes common to every route

| Code | When |
| --- | --- |
| 401 | Missing, invalid, expired or foreign Access token |
| 403 | Valid token for an email that is not allowed |
| 404 | Unknown route |
| 500 | Access not configured on the Worker (fail closed) or unexpected error |
