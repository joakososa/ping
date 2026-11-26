// Spec: docs/specs/notes.md (NOTE-*, AUD-*)

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { call } from "./helpers";

type Note = { id: string; text: string; version: number; deletedAt: string | null; createdAt: string };

const auditRows = async (id: string) =>
  (await env.DB.prepare("SELECT * FROM audit_log WHERE entity_id = ? ORDER BY id").bind(id).all()).results;

const create = async (text: string, id?: string) =>
  (await call("POST", "/api/notes", { body: id ? { id, text } : { text } })).body as Note;

const ids = (list: Note[]) => list.map((n) => n.id);

describe("create and list", () => {
  it("NOTE-01 creates a note with trimmed text and version 1 (201)", async () => {
    const id = crypto.randomUUID();
    const res = await call("POST", "/api/notes", { body: { id, text: "  hola  " } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id, text: "hola", version: 1, deletedAt: null });
    expect(res.body.createdAt).toBe(res.body.updatedAt);
  });

  it("NOTE-01 generates a UUID when no id is sent", async () => {
    const res = await call("POST", "/api/notes", { body: { text: "sin id" } });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("NOTE-02 lists visible notes, newest first", async () => {
    const older = await create("vieja");
    await new Promise((r) => setTimeout(r, 5));
    const newer = await create("nueva");
    const list = (await call("GET", "/api/notes")).body as Note[];
    expect(ids(list).indexOf(newer.id)).toBeLessThan(ids(list).indexOf(older.id));
  });

  it("NOTE-03 a repeated creation (same id, same text) returns 200 and the existing note", async () => {
    const id = crypto.randomUUID();
    await create("uno", id);
    const retry = await call("POST", "/api/notes", { body: { id, text: "uno" } });
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(id);
    const list = (await call("GET", "/api/notes")).body as Note[];
    expect(ids(list).filter((x) => x === id)).toHaveLength(1);
  });

  it("NOTE-04 refuses to reuse an id for a different text (409)", async () => {
    const id = crypto.randomUUID();
    await create("uno", id);
    expect((await call("POST", "/api/notes", { body: { id, text: "otro" } })).status).toBe(409);
  });

  it.each([
    ["body is an array", ["x"]],
    ["text missing", {}],
    ["text not a string", { text: 5 }],
    ["text blank", { text: "   " }],
    ["text over 2000 chars", { text: "x".repeat(2001) }],
    ["id not a UUID", { id: "nope", text: "x" }],
  ])("NOTE-05 refuses invalid input with 400: %s", async (_label, body) => {
    expect((await call("POST", "/api/notes", { body })).status).toBe(400);
  });
});

describe("update and delete", () => {
  it("NOTE-06 updates with the current version: trimmed text, version + 1", async () => {
    const note = await create("v1");
    const res = await call("PATCH", `/api/notes/${note.id}`, { body: { text: " v2 ", version: 1 } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: note.id, text: "v2", version: 2 });
  });

  it("NOTE-07 refuses a stale version with 409 and the current note, changing nothing", async () => {
    const note = await create("v1");
    await call("PATCH", `/api/notes/${note.id}`, { body: { text: "v2", version: 1 } });
    const stale = await call("PATCH", `/api/notes/${note.id}`, { body: { text: "pisada", version: 1 } });
    expect(stale.status).toBe(409);
    expect(stale.body.current).toMatchObject({ text: "v2", version: 2 });
    const row = await env.DB.prepare("SELECT text, version FROM notes WHERE id = ?").bind(note.id).first();
    expect(row).toEqual({ text: "v2", version: 2 });
  });

  it("NOTE-08 soft-deletes: hidden from the list, kept in the database", async () => {
    const note = await create("chau");
    const res = await call("PATCH", `/api/notes/${note.id}`, { body: { delete: true, version: 1 } });
    expect(res.status).toBe(200);
    expect(res.body.deletedAt).not.toBeNull();
    expect(ids((await call("GET", "/api/notes")).body)).not.toContain(note.id);
    const row = await env.DB.prepare("SELECT deleted_at FROM notes WHERE id = ?").bind(note.id).first();
    expect(row?.deleted_at).not.toBeNull();
  });

  it("NOTE-09 answers 404 for unknown and deleted notes", async () => {
    const unknown = await call("PATCH", `/api/notes/${crypto.randomUUID()}`, { body: { text: "x", version: 1 } });
    expect(unknown.status).toBe(404);
    const note = await create("x");
    await call("PATCH", `/api/notes/${note.id}`, { body: { delete: true, version: 1 } });
    expect((await call("PATCH", `/api/notes/${note.id}`, { body: { text: "revive", version: 2 } })).status).toBe(404);
  });

  it.each([
    ["no version", { text: "y" }],
    ["version not an integer", { text: "y", version: "1" }],
    ["nothing to change", { version: 1 }],
    ["blank text", { text: " ", version: 1 }],
  ])("NOTE-10 refuses an invalid update with 400: %s", async (_label, body) => {
    const note = await create("x");
    expect((await call("PATCH", `/api/notes/${note.id}`, { body })).status).toBe(400);
  });
});

describe("audit", () => {
  it("AUD-01 records create, update and delete with actor, operation and before/after rows", async () => {
    const note = await create("v1");
    await call("PATCH", `/api/notes/${note.id}`, { body: { text: "v2", version: 1 } });
    await call("PATCH", `/api/notes/${note.id}`, { body: { delete: true, version: 2 } });

    const rows = await auditRows(note.id);
    expect(rows.map((r) => r.operation)).toEqual(["create", "update", "delete"]);
    for (const r of rows) expect(r).toMatchObject({ actor: "pwa", entity: "notes", entity_id: note.id });
    expect(rows[0]!.before_json).toBeNull();
    expect(JSON.parse(rows[0]!.after_json as string).text).toBe("v1");
    expect(JSON.parse(rows[1]!.before_json as string).text).toBe("v1");
    expect(JSON.parse(rows[1]!.after_json as string).text).toBe("v2");
    expect(JSON.parse(rows[2]!.after_json as string).deletedAt).not.toBeNull();
    expect(rows[1]!.changed_at).toBe(JSON.parse(rows[1]!.after_json as string).updatedAt);
  });

  it("AUD-02 refused or no-op writes add no audit rows", async () => {
    const id = crypto.randomUUID();
    await create("v1", id);
    await call("POST", "/api/notes", { body: { id, text: "v1" } }); // repeated creation
    await call("POST", "/api/notes", { body: { id, text: "otro" } }); // id taken
    await call("PATCH", `/api/notes/${id}`, { body: { text: "x", version: 7 } }); // stale version
    await call("PATCH", `/api/notes/${id}`, { body: { text: " ", version: 1 } }); // invalid
    expect(await auditRows(id)).toHaveLength(1);
  });

  it("AUD-03 a write whose audit insert fails is rolled back with it", async () => {
    // Break the audit table for this test only: the write must not survive without its audit row.
    await env.DB.prepare("ALTER TABLE audit_log RENAME TO audit_log_off").run();
    try {
      const id = crypto.randomUUID();
      const res = await call("POST", "/api/notes", { body: { id, text: "sin auditoría" } });
      expect(res.status).toBe(500);
      expect(await env.DB.prepare("SELECT id FROM notes WHERE id = ?").bind(id).first()).toBeNull();
    } finally {
      await env.DB.prepare("ALTER TABLE audit_log_off RENAME TO audit_log").run();
    }
  });
});
