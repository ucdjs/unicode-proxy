import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { setupImagesRoutes } from "./routes/_images";
import { setupProxyRoutes } from "./routes/proxy";
import { setupRawRoutes } from "./routes/raw";

export interface ApiError {
  path: string;
  status: number;
  message: string;
  timestamp: string;
}

const app = new Hono<{
  Bindings: CloudflareBindings;
}>({
  strict: false,
});

setupImagesRoutes(app);
setupProxyRoutes(app);
setupRawRoutes(app);

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
