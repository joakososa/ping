# ADR-0010: English for code, API and database; Spanish for the UI

- Status: Accepted (2026-11-26)
- Date: 2026-11-24

## Context
The first version mixed languages: `/api/me` next to `/api/notas`, fields like `texto` and `borradoEn`, tables
`notas` and `cambios`. Joaquin asked for the API in English and agreed to make everything technical English. The
systems are for Joaquin, who reads the UI in Spanish.

## Decision
- **English:** code identifiers, API paths and JSON fields, database tables and columns, audit values
  (`create`, `update`, `delete`), spec ids (`NOTE-*`), file names, comments and `docs/`.
- **Spanish:** everything the user sees in the UI (labels, messages, notices), PR descriptions and conversation
  with Joaquin.
- JSON uses camelCase (`createdAt`); SQL uses snake_case (`created_at`).

## Consequences
- One vocabulary per layer; the mapping between them is explicit in `docs/api.md` and `docs/db-schema.md`.
- Branch names already pushed (`feat/notas`) keep their names; new branches use English.
