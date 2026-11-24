// Audit log (template code: copy as-is into every system).
//
// Every write is sent to D1 as a batch (a transaction) of [the write, the audit insert]. The audit insert
// only adds a row when the previous statement changed something (`WHERE changes() = 1`), so a write that
// matched nothing (wrong version, duplicate id) leaves no audit row.

export type Actor = "pwa" | "mcp" | "script";

export interface AuditEntry {
  ts: string;
  actor: Actor;
  operacion: string;
  entidad: string;
  entidadId: string;
  antes: unknown;
  despues: unknown;
}

const toJson = (value: unknown): string | null => (value === null || value === undefined ? null : JSON.stringify(value));

/** Audit insert that only takes effect if the statement right before it in the batch changed exactly one row. */
export function auditIfChanged(db: D1Database, entry: AuditEntry): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO cambios (ts, actor, operacion, entidad, entidad_id, antes, despues)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
    )
    .bind(entry.ts, entry.actor, entry.operacion, entry.entidad, entry.entidadId, toJson(entry.antes), toJson(entry.despues));
}
