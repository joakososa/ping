# API contract

Base: `https://ping.joakososa.dev/api`. Behind Cloudflare Access; every request needs the Access session (the
browser sends it automatically; Access adds `Cf-Access-Jwt-Assertion`). JSON in and out. Names are in English
(ADR-0010, English for code, API and database; Spanish for the UI).
All responses: `Cache-Control: no-store`. Errors: `{ "error": string }` (plus `current` on 409).

## Types

```ts
type Note = {
  id: string;               // UUID
  text: string;             // 1..2000 chars, trimmed
  createdAt: string;        // ISO 8601 UTC
  updatedAt: string;        // ISO 8601 UTC
  version: number;          // starts at 1, +1 on every update
  deletedAt: string | null; // set when soft-deleted
};
```

## Endpoints

### `GET /api/me`
→ `200 { "email": string }`

### `GET /api/notes`
→ `200 Note[]` visible notes, newest first.

### `POST /api/notes`
Body: `{ "id"?: string /* UUID */, "text": string }`
- `201 Note` created
- `200 Note` same `id` and `text` already existed (safe retry)
- `400` invalid input · `409` the `id` exists with another text

### `PATCH /api/notes/:id`
Body: `{ "version": number, "text"?: string, "delete"?: true }` (at least one of `text`, `delete`)
- `200 Note` updated (or soft-deleted: `deletedAt` set)
- `400` invalid input · `404` unknown or deleted · `409 { error, current: Note }` stale `version`

## Status codes common to every route

| Code | When |
| --- | --- |
| 401 | Missing, invalid, expired or foreign Access token |
| 403 | Valid token for an email that is not allowed |
| 404 | Unknown route |
| 500 | Access not configured on the Worker (fail closed) or unexpected error |
