/**
 * Worker API Definition
 *
 * Main HttpApi class that defines the complete API structure.
 *
 * @module
 */
import { HttpApi } from "effect/unstable/httpapi";

import { CloudflareBindingsMiddleware } from "../middleware";
import { HealthGroup, UsersGroup } from "./groups";

/**
 * Worker API definition.
 *
 * All endpoints are prefixed with `/api`.
 * CloudflareBindings is available to all handlers via middleware.
 */
export class WorkerApi extends HttpApi.make("WorkerApi")
  .add(HealthGroup)
  .add(UsersGroup)
  .middleware(CloudflareBindingsMiddleware)
  .prefix("/api") {}
