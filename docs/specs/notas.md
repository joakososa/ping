# Spec: Notes API and audit log (`NOT`, `AUD`)

- Status: Proposed
- Implements: ADR-0005, ADR-0006, ADR-0007
- Tests: `test/notas.test.ts`
- Contract: `docs/api.md` · Schema: `docs/db-schema.md`

All requests carry a valid Access token (spec `ACC`). A "note" is `{ id, texto, creado, actualizado, version,
borradoEn }`.

## Create and list

| Id | Requirement |
| --- | --- |
| NOT-01 | `POST /api/notas { id?, texto }` creates a note with `texto` trimmed, `version` 1, `borradoEn` null, and answers **201** with it. Without `id`, the server generates a UUID. |
| NOT-02 | `GET /api/notas` returns the visible (not deleted) notes, newest `creado` first. |
| NOT-03 | Repeating a creation with the **same `id` and same text** answers **200** with the existing note and creates nothing new. |
| NOT-04 | Creating with an `id` that already exists and a **different text** answers **409**. |
| NOT-05 | Invalid input answers **400**: body not a JSON object; `texto` missing, not a string, empty after trimming, or longer than 2000 characters; `id` present but not a UUID. |

## Update and delete

| Id | Requirement |
| --- | --- |
| NOT-06 | `PATCH /api/notas/:id { version, texto }` with the current `version` updates the text (trimmed), increments `version`, refreshes `actualizado`, and answers **200** with the note. |
| NOT-07 | A `PATCH` with a `version` that is not the current one answers **409** `{ error, actual }` with the current note, and changes nothing. |
| NOT-08 | `PATCH { version, borrar: true }` soft-deletes: answers **200** with `borradoEn` set; the note disappears from `GET /api/notas` but stays in the database. |
| NOT-09 | A `PATCH` on an unknown or deleted note answers **404**. |
| NOT-10 | A `PATCH` without an integer `version`, or with nothing to change, answers **400**. |

## Audit

| Id | Requirement |
| --- | --- |
| AUD-01 | Every successful write (create, edit, delete) adds exactly one row to `cambios` with actor `pwa`, the operation (`crear`, `editar`, `borrar`), entity `notas`, the note id, and JSON snapshots before (null on create) and after. |
| AUD-02 | A write that is refused or changes nothing (validation error, stale version, repeated creation) adds no row to `cambios`. |
| AUD-03 | The write and its audit row are committed together (one D1 batch). |
