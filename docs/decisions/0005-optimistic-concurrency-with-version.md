# ADR-0005: Optimistic concurrency with an integer `version`

- Status: Proposed
- Date: 2026-11-24

## Context
The same record can be changed from the phone (PWA) and from a Claude chat (MCP) at nearly the same time. Without
a check, the second save silently overwrites the first (e.g. a card edited on the phone erases a proposal Claude
just added). The original plan used an `actualizado` timestamp; timestamps can collide and compare poorly.

## Decision
- Every mutable table has `version INTEGER NOT NULL DEFAULT 1` (plus `actualizado`, an ISO timestamp, for display).
- Every update sends the `version` it read. The update runs as `... WHERE id = ? AND version = ?` and increments
  `version`.
- If the version does not match, the write is refused with **409** and the current record (`actual`), never
  applied. The PWA shows "this changed while you had it open" and the current version; an MCP tool returns an
  error saying the record changed since it was read.

## Consequences
- No lost updates. Clients must keep the `version` they read and handle 409.
- Creations are not versioned (see ADR-0007).
