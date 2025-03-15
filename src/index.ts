import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiError, HonoEnv } from "./types";
import { parse } from "apache-autoindex-parse";
import { Hono } from "hono";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import { proxy } from "hono/proxy";

const app = new Hono<HonoEnv>({
  strict: false,
});

// app.get(
//   "*",
//   cache({
//     cacheName: "unicode-proxy",
//     cacheControl: "max-age=3600",
//   }),
// );

app.get("/proxy", async (c) => {
  const response = await fetch("https://unicode.org/Public?F=2");
  const html = await response.text();
  const files = parse(html, "F2");

  if (!files) {
    throw new HTTPException(500, {
      message: "Failed to parse the directory listing",
    });
  }

  return c.json(files.children.map((file) => ({
    type: file.type,
    name: file.name,
    path: file.path.replace("/Public", ""),
  })));
});

app.get("/proxy/:path{.*}", async (c) => {
  const path = c.req.param("path");
  const res = await proxy(`https://unicode.org/Public/${path}?F=2`);

  if (!res.ok) {
    throw new HTTPException(res.status as ContentfulStatusCode, {
      message: res.statusText,
    });
  }

  // if the response is a directory, parse the html and return the files
  if (res.headers.get("content-type")?.includes("text/html") && !path.endsWith("html")) {
    const html = await res.text();
    const files = parse(html, "F2");

    if (!files) {
      throw new HTTPException(500, {
        message: "Failed to parse the directory listing",
      });
    }

    return c.json(files?.children.map((file) => ({
      type: file.type,
      name: file.name,
      path: file.path.replace(`/Public/${path}`, ""),
    })));
  }

  return res;
});

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
