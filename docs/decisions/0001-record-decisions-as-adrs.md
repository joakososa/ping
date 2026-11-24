# ADR-0001: Record decisions as ADRs

- Status: Proposed
- Date: 2026-11-24

## Context
Decisions about these systems are made in conversations between Joaquin and Claude. Conversations are not a
durable record, and later agents (or Joaquin months from now) need to know what was decided and why.

## Decision
- Every important decision is written as an ADR in `docs/decisions/NNNN-short-title.md` (Context, Decision,
  Consequences), drafted by Claude from what was agreed, approved by Joaquin.
- Status flow: `Proposed` → `Accepted (YYYY-MM-DD)`. A rejected proposal is deleted in its PR, not kept.
- An accepted ADR is **immutable**. The only allowed edit is a line under the status: `Superseded by ADR-NNNN` or
  `Amended by ADR-NNNN`. A changed decision is a new ADR that references the old one.
- `CLAUDE.md` keeps an index with one line per ADR saying what it decides.
- Behavior is specified in `docs/specs/` with numbered requirements; tests reference those ids.

## Consequences
- Reviewing an ADR is part of reviewing the PR that introduces it.
- Systems created from this template copy these ADRs as their starting point (they apply to them too) and continue
  the numbering.
