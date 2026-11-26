// Audit log (template code: copy as-is into every system).
//
// Every write is sent to D1 as a batch (a transaction) of [the write, the audit insert]. The audit insert
// only adds a row when the previous statement changed something (`WHERE changes() = 1`), so a write that
// matched nothing (wrong version, duplicate id) leaves no audit row.

export type Actor = "pwa" | "mcp" | "script";
export type Operation = "create" | "update" | "delete";

export interface AuditEntry {
  changedAt: string;
  actor: Actor;
  operation: Operation;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
}

const toJson = (value: unknown): string | null => (value === null || value === undefined ? null : JSON.stringify(value));

/** Audit insert that only takes effect if the statement right before it in the batch changed exactly one row. */
export function auditIfChanged(db: D1Database, entry: AuditEntry): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_log (changed_at, actor, operation, entity, entity_id, before_json, after_json)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
    )
    .bind(
      entry.changedAt,
      entry.actor,
      entry.operation,
      entry.entity,
      entry.entityId,
      toJson(entry.before),
      toJson(entry.after),
    );
}
