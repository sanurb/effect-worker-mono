/**
 * PgDrizzle Service Tag
 *
 * Type-only entry point for the PgDrizzle tag. Import from here (instead of
 * `./index`) for middleware definitions and other type-level references, to
 * avoid pulling in Node.js-only deps (`pg`).
 *
 * @module
 */
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres";
import { Context } from "effect";

export class PgDrizzle extends Context.Service<PgDrizzle, EffectPgDatabase>()(
  "@repo/db/PgDrizzle",
) {}
