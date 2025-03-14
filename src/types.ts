import type { Env } from "hono";

export interface HonoEnv extends Env {
  Bindings: CloudflareBindings;
}

export interface ApiError {
  path: string;
  status: number;
  message: string;
  timestamp: string;
}
