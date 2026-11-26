import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
      POLICY_AUD: string;
      ALLOWED_EMAIL: string;
    }
  }
}
