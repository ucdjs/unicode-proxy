import type { ApiError, HonoEnv } from "./types";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cache } from "./cache";
import { RAW_ROUTER } from "./routes/raw";

const app = new Hono<HonoEnv>();

app.get(
  "*",
  cache({
    cacheName: "my-app",
    cacheControl: "max-age=3600",
  }),
);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.route("/raw", RAW_ROUTER);

app.onError(async (err, c) => {
  console.error(err);
  const url = new URL(c.req.url);
  if (err instanceof HTTPException) {
    return c.json({
      path: url.pathname,
      status: err.status,
      message: err.message,
      timestamp: new Date().toISOString(),
    } satisfies ApiError, err.status);
  }

  return c.json({
    path: url.pathname,
    status: 500,
    message: "Internal server error",
    timestamp: new Date().toISOString(),
  } satisfies ApiError, 500);
});

app.notFound(async (c) => {
  const url = new URL(c.req.url);
  return c.json({
    path: url.pathname,
    status: 404,
    message: "Not found",
    timestamp: new Date().toISOString(),
  } satisfies ApiError, 404);
});

export default app;
