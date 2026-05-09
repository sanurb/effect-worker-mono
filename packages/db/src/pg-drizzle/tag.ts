/** PgDrizzle service tag — separate module from `./index` so middleware can reference it without pulling `pg` at runtime. */
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres";
import { Context } from "effect";

export class PgDrizzle extends Context.Service<PgDrizzle, EffectPgDatabase>()(
  "@repo/db/PgDrizzle",
) {}
