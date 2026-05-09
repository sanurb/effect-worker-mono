/**
 * @repo/db
 *
 * Database schema and queries for Effect Worker.
 *
 * This package contains Drizzle ORM schema definitions and
 * reusable Effect query programs shared across all apps.
 *
 * @module
 */

// Schema exports
export { users, type User as DbUser, type NewUser } from "./schema";

// Adapter errors
export { DatabaseConnectionError } from "./errors";

// Query exports
export * from "./queries";

// PgDrizzle service and factory
export { PgDrizzle, makeDrizzle } from "./pg-drizzle/index.js";
