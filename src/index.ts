import type { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";
import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import { proxy } from "hono/proxy";
import { parseUnicodeDirectory } from "./lib";

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
  const key
    = c.req.header("cf-connecting-ip")
      ?? c.req.raw.headers.get("x-forwarded-for")
      ?? crypto.randomUUID(); // last-resort unique key
  const { success } = await c.env.RATE_LIMITER.limit({ key });

  if (!success) {
    throw new HTTPException(429, {
      message: "Too Many Requests - Please try again later",
    });
  }

  await next();
});

app.get("/favicon.ico", (c) => {
  return c.newResponse(null, 204, {});
});

app.get("*", cache({
  cacheName: "unicode-proxy",
  cacheControl: "max-age=604800, stale-while-revalidate=86400",
}));

app.get(
  "/:path{.*}?",
  async (c) => {
    const path = c.req.param("path") || "";
    const res = await proxy(`https://unicode.org/Public/${path}?F=2`);

    if (!res.ok) {
      throw new HTTPException(res.status as ContentfulStatusCode, {
        message: res.statusText,
      });
    }

    // if the response is a directory, parse the html and return the files
    if (res.headers.get("content-type")?.includes("text/html") && !path.endsWith("html")) {
      const { files } = await parseUnicodeDirectory(await res.text());

      c.header("Last-Modified", res.headers.get("Last-Modified") ?? "");
      return c.json(files);
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

export default class UnicodeProxy extends WorkerEntrypoint<CloudflareBindings> {
  async getUnicodeDirectory(path: string = ""): ReturnType<typeof parseUnicodeDirectory> {
    const url = path ? `https://unicode.org/Public/${path}?F=2` : "https://unicode.org/Public?F=2";

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch directory: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    return parseUnicodeDirectory(html);
  }

  async fetch(request: Request) {
    return app.fetch(request, this.env, this.ctx);
  }
}
