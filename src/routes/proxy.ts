import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { parse } from "apache-autoindex-parse";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import { proxy } from "hono/proxy";

const cacheName = "unicode-proxy";
const cacheControl = "max-age=3600";

export function setupProxyRoutes(app: Hono<{
  Bindings: CloudflareBindings;
}>) {
  app.get(
    "/proxy",
    cache({
      cacheName,
      cacheControl,
    }),
    async (c) => {
      const response = await fetch("https://unicode.org/Public?F=2");
      const html = await response.text();
      const files = parse(html, "F2");

      if (!files) {
        throw new HTTPException(500, {
          message: "Failed to parse the directory listing",
        });
      }

      return c.json(files.children.map((file) => {
        const path = file.path.replace("/Public/", "");
        return {
          type: file.type,
          name: file.name.endsWith("/") ? file.name.slice(0, -1) : file.name,
          path: path.endsWith("/") ? path.slice(0, -1) : path,
        };
      }));
    },
  );

  app.get(
    "/proxy/:path{.*}",
    cache({
      cacheName,
      cacheControl,
    }),
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

        return c.json(files?.children.map((file) => {
          const filePath = file.path.replace(`/Public/${path}/`, "");
          return {
            type: file.type,
            name: file.name.endsWith("/") ? file.name.slice(0, -1) : file.name,
            path: filePath.endsWith("/") ? filePath.slice(0, -1) : filePath,
          };
        }));
      }

      return res;
    },
  );
}
