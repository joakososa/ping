// Spec: docs/specs/access.md (ACC-*)

import { describe, expect, it } from "vitest";
import { call, EMAIL, token } from "./helpers";

describe("Access gate", () => {
  it("ACC-01 refuses a request without the Access header", async () => {
    expect((await call("GET", "/api/yo", { jwt: null })).status).toBe(401);
  });

  it("ACC-02 refuses a token signed by a key outside the team's key set", async () => {
    expect((await call("GET", "/api/yo", { jwt: await token({ useForeignKey: true }) })).status).toBe(401);
  });

  it("ACC-03 refuses a token for another Access application", async () => {
    expect((await call("GET", "/api/yo", { jwt: await token({ aud: "other-app" }) })).status).toBe(401);
  });

  it("ACC-04 refuses a token from another team", async () => {
    const jwt = await token({ issuer: "https://someone-else.cloudflareaccess.com" });
    expect((await call("GET", "/api/yo", { jwt })).status).toBe(401);
  });

  it("ACC-05 refuses an expired token", async () => {
    const jwt = await token({ expiresAt: Math.floor(Date.now() / 1000) - 60 });
    expect((await call("GET", "/api/yo", { jwt })).status).toBe(401);
  });

  it("ACC-06 refuses a valid token for an email that is not allowed", async () => {
    expect((await call("GET", "/api/yo", { jwt: await token({ email: "someone@else.com" }) })).status).toBe(403);
  });

  it("ACC-07 compares the email ignoring case and surrounding spaces", async () => {
    const res = await call("GET", "/api/yo", {
      jwt: await token({ email: " Joaquin@Example.COM " }),
      env: { ALLOWED_EMAIL: "JOAQUIN@example.com " },
    });
    expect(res.status).toBe(200);
  });

  it.each([
    ["POLICY_AUD empty", { POLICY_AUD: "" }],
    ["ALLOWED_EMAIL missing", { ALLOWED_EMAIL: undefined }],
    ["TEAM_DOMAIN placeholder", { TEAM_DOMAIN: "CHANGE-ME.cloudflareaccess.com" }],
    ["TEAM_DOMAIN blank", { TEAM_DOMAIN: "  " }],
  ])("ACC-08 fails closed with 500 when %s, even with a valid token", async (_label, env) => {
    expect((await call("GET", "/api/yo", { env })).status).toBe(500);
  });

  it("ACC-09 marks every /api response no-store, including errors", async () => {
    for (const res of [
      await call("GET", "/api/yo"),
      await call("GET", "/api/yo", { jwt: null }),
      await call("GET", "/api/yo", { jwt: await token({ email: "x@y.z" }) }),
      await call("GET", "/api/nada"),
    ]) {
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("ACC-10 /api/yo returns the allowed email in lower case", async () => {
    const res = await call("GET", "/api/yo", { jwt: await token({ email: "Joaquin@Example.com" }) });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: EMAIL });
  });

  it("ACC-11 answers 404 for an unknown /api route", async () => {
    const res = await call("GET", "/api/nada");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("ACC-12 error bodies are JSON { error } and do not echo the token", async () => {
    const jwt = await token({ email: "someone@else.com" });
    const res = await call("GET", "/api/yo", { jwt });
    expect(Object.keys(res.body)).toEqual(["error"]);
    expect(res.text).not.toContain(jwt);
    expect(res.text).not.toContain("someone@else.com");
  });
});
