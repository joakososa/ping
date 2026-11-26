// Cloudflare Access verification (template code: copy as-is into every system).
//
// Access is the gate: it authenticates the user before a request reaches the Worker and adds a signed JWT
// in the `Cf-Access-Jwt-Assertion` header. The Worker checks that JWT again (defense in depth), so a request
// that somehow skips Access (a misconfigured route, a workers.dev URL left on) is still rejected.

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { MiddlewareHandler } from "hono";

export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

export interface AccessConfig {
  /** e.g. "my-team.cloudflareaccess.com" */
  teamDomain: string;
  /** Application Audience (AUD) tag of the Access application. */
  aud: string;
  /** The only email allowed in, in addition to the Access policy. */
  allowedEmail: string;
}

export interface AccessIdentity {
  email: string;
}

export class AccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 500,
  ) {
    super(message);
  }
}

const keySets = new Map<string, JWTVerifyGetKey>();

/** Public keys of the Access team, fetched once per isolate and cached by `jose`. */
export function remoteKeySet(teamDomain: string): JWTVerifyGetKey {
  let keySet = keySets.get(teamDomain);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    keySets.set(teamDomain, keySet);
  }
  return keySet;
}

function isConfigured(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "" && !value.includes("CHANGE-ME");
}

/** Throws AccessError unless `token` is a valid Access JWT for this application and the allowed email. */
export async function verifyAccessJwt(
  token: string | null | undefined,
  config: Partial<AccessConfig>,
  getKey: JWTVerifyGetKey,
): Promise<AccessIdentity> {
  // Fail closed: a missing setting must never mean "let everyone in".
  if (!isConfigured(config.teamDomain) || !isConfigured(config.aud) || !isConfigured(config.allowedEmail)) {
    throw new AccessError("Access is not configured on this Worker", 500);
  }
  if (!token) {
    throw new AccessError("Missing Access token", 401);
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, getKey, {
      issuer: `https://${config.teamDomain}`,
      audience: config.aud,
    }));
  } catch {
    throw new AccessError("Invalid Access token", 401);
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || email !== config.allowedEmail.trim().toLowerCase()) {
    throw new AccessError("This account is not allowed", 403);
  }
  return { email };
}

export interface AccessBindings {
  TEAM_DOMAIN: string;
  POLICY_AUD?: string;
  ALLOWED_EMAIL?: string;
}

/** Hono middleware: verifies the Access JWT and stores the identity in `c.var.identity`. */
export function requireAccess<B extends AccessBindings>(
  getKeyFor: (env: B) => JWTVerifyGetKey,
): MiddlewareHandler<{ Bindings: B; Variables: { identity: AccessIdentity } }> {
  return async (c, next) => {
    try {
      const identity = await verifyAccessJwt(
        c.req.header(ACCESS_JWT_HEADER),
        { teamDomain: c.env.TEAM_DOMAIN, aud: c.env.POLICY_AUD, allowedEmail: c.env.ALLOWED_EMAIL },
        getKeyFor(c.env),
      );
      c.set("identity", identity);
    } catch (error) {
      if (error instanceof AccessError) {
        return c.json({ error: error.message }, error.status);
      }
      throw error;
    }
    await next();
  };
}
