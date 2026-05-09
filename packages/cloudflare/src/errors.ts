/**
 * Cloudflare Adapter Errors
 *
 * Failure modes produced by the Cloudflare runtime adapter. Lives here, not in
 * `@repo/domain`, because these errors describe Worker-runtime concerns
 * (missing bindings, request-scope misconfiguration) — not the language of
 * the system.
 *
 * @module
 */
import { Schema as S } from "effect";

export class CloudflareBindingsError extends S.TaggedErrorClass<CloudflareBindingsError>()(
  "CloudflareBindingsError",
  { message: S.String },
  { httpApiStatus: 500 },
) {}
