import { randomBytes } from "crypto";

/**
 * URL-safe share token, generated in-app. The share_links.token column
 * once defaulted to encode(..., 'base64url') which Postgres rejects, so
 * the app always supplies the token itself.
 */
export function makeShareToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
