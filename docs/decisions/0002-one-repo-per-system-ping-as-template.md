# ADR-0002: One repo per system, `ping` as the template

- Status: Accepted (2026-11-26)
- Date: 2026-11-24

## Context
Joaquin's systems (Libreta, Mesa, Finanzas, Estudio) are unrelated to each other. Each one already gets its own
Worker, D1 database, MCP connector and PWA. A monorepo was considered and rejected by Joaquin.

## Decision
- One GitHub repo per system. `respaldos` is a separate repo for nightly database exports.
- `ping` is the first system, used to prove the whole chain with throwaway data, and then marked as a GitHub
  **template repository**. New systems are created from it.
- Shared code (`src/core/`: Access verification, audit log; later the MCP scaffolding) is **copied** from the
  template into each system, not published as a package. It is extracted into a package only if it starts changing
  often and the copies drift.

## Consequences
- Per-repo permissions (e.g. Finanzas can have stricter access), clean history per system, any system can be made
  public as a portfolio piece without exposing the others.
- A fix to `src/core/` must be applied to each system by hand (few systems, small code).
- CI and docs conventions are copied from the template, so they stay uniform.
