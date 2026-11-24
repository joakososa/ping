// Test helpers: a local Access "team" whose keys sign tokens, and a way to call the app with them.

import { env } from "cloudflare:workers";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { createApp, type Bindings } from "../src/app";

export const TEAM = "test-team.cloudflareaccess.com";
export const AUD = "test-aud";
export const EMAIL = "joaquin@example.com";

const keys = (async () => {
  const pair = await generateKeyPair("RS256");
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  const other = await generateKeyPair("RS256");
  return { privateKey: pair.privateKey, jwk, otherPrivateKey: other.privateKey };
})();

export interface TokenOptions {
  email?: string;
  aud?: string;
  issuer?: string;
  useForeignKey?: boolean;
  expiresAt?: number; // seconds since epoch
}

export async function token(opts: TokenOptions = {}): Promise<string> {
  const k = await keys;
  return new SignJWT({ email: opts.email ?? EMAIL })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.issuer ?? `https://${TEAM}`)
    .setAudience(opts.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(opts.expiresAt ?? "5m")
    .sign(opts.useForeignKey ? k.otherPrivateKey : k.privateKey);
}

export interface CallOptions {
  body?: unknown;
  /** undefined = a valid token; null = no header at all */
  jwt?: string | null;
  env?: Partial<Bindings>;
}

export async function call(method: string, path: string, opts: CallOptions = {}) {
  const k = await keys;
  const app = createApp({ getKeyFor: () => createLocalJWKSet({ keys: [k.jwk] }) });
  const headers = new Headers({ "Content-Type": "application/json" });
  const jwt = opts.jwt === undefined ? await token() : opts.jwt;
  if (jwt) headers.set("Cf-Access-Jwt-Assertion", jwt);
  const res = await app.fetch(
    new Request(`https://ping.example${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
    { ...(env as unknown as Bindings), ...opts.env },
  );
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, body: text ? JSON.parse(text) : null };
}
