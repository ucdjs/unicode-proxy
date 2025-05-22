import type { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";
import { parse } from "apache-autoindex-parse";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { proxy } from "hono/proxy";
import { cache } from "./cache";

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

app.use("*", async (c, next) => {
  const key = c.req.header("cf-connecting-ip") ?? "";
  const { success } = await c.env.RATE_LIMITER.limit({ key });

  if (!success) {
    throw new HTTPException(429, {
      message: "Too Many Requests - Please try again later",
    });
  }

  await next();
});

app.get("*", cache({
  cacheName: "unicode-proxy",
  cacheControl: "max-age=604800, stale-while-revalidate=86400",
}));

function trimTrailingSlash(path: string) {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

app.get(
  "/",
  async (c) => {
    const response = await fetch("https://unicode.org/Public?F=2");
    const html = await response.text();
    const files = parse(html, "F2");

    if (!files) {
      throw new HTTPException(500, {
        message: "Failed to parse the directory listing",
      });
    }

    c.header("Last-Modified", response.headers.get("Last-Modified") ?? "");
    return c.json(files.children.map(({ type, name, path, lastModified }) => {
      return {
        type,
        name: trimTrailingSlash(name),
        path: trimTrailingSlash(path),
        lastModified,
      };
    }));
  },
);

app.get(
  "/:path{.*}",
  async (c) => {
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

      c.header("Last-Modified", res.headers.get("Last-Modified") ?? "");
      return c.json(files?.children.map(({ name, path, type, lastModified }) => {
        return {
          type,
          name: trimTrailingSlash(name),
          path: trimTrailingSlash(path),
          lastModified,
        };
      }));
    }

    return c.newResponse(res.body, res.status as StatusCode, {
      "Last-Modified": res.headers.get("Last-Modified") ?? "",
      "Content-Type": res.headers.get("Content-Type") ?? "",
      "Content-Length": res.headers.get("Content-Length") ?? "",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? "",
    });
  },
);

app.onError(async (err, c) => {
  console.error(err);
  const url = new URL(c.req.url);
  if (err instanceof HTTPException) {
    return c.json({
      path: url.pathname + url.search,
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
    path: url.pathname + url.search,
    status: 404,
    message: "Not found",
    timestamp: new Date().toISOString(),
  } satisfies ApiError, 404);
});

export default app;
