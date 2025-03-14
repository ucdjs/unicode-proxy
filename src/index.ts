import type { ApiError, HonoEnv } from "./types";
import { parse } from "apache-autoindex-parse";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { proxy } from "hono/proxy";
import { cache } from "./cache";

const app = new Hono<HonoEnv>();

app.get(
  "*",
  cache({
    cacheName: "unicode-proxy",
    cacheControl: "max-age=3600",
  }),
);

app.get("/", async (c) => {
  const response = await fetch("https://unicode.org/Public?F=0");
  const html = await response.text();
  const files = parse(html, "F0");

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

app.get("/:path", async (c) => {
  const res = await proxy(`https://unicode.org/Public/${c.req.param("path")}?F=0`);

  if (!res.ok) {
    return c.json({
      path: c.req.path,
      status: res.status,
      message: res.statusText,
      timestamp: new Date().toISOString(),
    } satisfies ApiError);
  }

  // if the response is a directory, parse the html and return the files
  if (res.headers.get("content-type")?.includes("text/html")) {
    const html = await res.text();
    const files = parse(html, "F0");

    if (!files) {
      throw new HTTPException(500, {
        message: "Failed to parse the directory listing",
      });
    }

    return c.json(files?.children.map((file) => ({
      type: file.type,
      name: file.name,
      path: file.path.replace("/Public", ""),
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
