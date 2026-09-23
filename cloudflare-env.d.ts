declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    LUMA_AUTH_MODE?: string;
  }
}
