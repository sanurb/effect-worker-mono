/**
 * PgDrizzle Service Tag
 *
 * Lightweight module containing only the PgDrizzle service tag.
 * Import from here (instead of the full pg-drizzle module) when you only need
 * the tag for type-level references (e.g. middleware definitions), to avoid
 * pulling in Node.js-only dependencies like pg.
 *
 * Drizzle 1.0.0-rc.1 ships native Effect v4 support via
 * `drizzle-orm/effect-postgres`. The service now carries an `EffectPgDatabase`
 * whose query builders return real `Effect` values — no QueryPromise patch.
 *
 * @module
 */
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres";
import { Context } from "effect";

/**
 * PgDrizzle service tag — provides a Drizzle EffectPgDatabase instance.
 */
export class PgDrizzle extends Context.Service<PgDrizzle, EffectPgDatabase>()(
  "@repo/db/PgDrizzle",
) {}
