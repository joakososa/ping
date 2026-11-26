declare global {
  namespace Cloudflare {
    interface Env {
      POLICY_AUD: string;
      ALLOWED_EMAIL: string;
    }
  }
}

export {};
