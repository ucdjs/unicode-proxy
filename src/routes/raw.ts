import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";

function transformHtml(response: Response, basePath = "") {
  return new HTMLRewriter()
    .on("img", {
      element(element) {
        const src = element.getAttribute("src");
        if (src) {
          element.setAttribute("src", `/_images?icon=${src}`);
        }
      },
    }).on("a", {
      element(element) {
        let href = element.getAttribute("href");

        if (href == null || href.trim() === "") {
          return;
        }

        if (href.startsWith("http") || href.startsWith("https")) {
          return;
        }

        if (href.startsWith("/")) {
          if (href.includes("/Public/")) {
            href = href.replace("/Public/", "/");
          }

          element.setAttribute("href", `/raw${href}`);
          return;
        }

        element.setAttribute("href", `/raw/${basePath}${basePath ? "/" : ""}${href}`);
      },
    }).transform(response);
}

const cacheName = "unicode-proxy-raw";
const cacheControl = "max-age=3600";

const ALLOWED_QUERY_PARAMS = ["C", "O", "F", "V", "P"];

function setQueryParams(url: URL, query: Record<string, string>) {
  // filter out query params that are not in the ALLOWED_QUERY_PARAMS array
  const filteredQuery = Object.fromEntries(
    Object.entries(query).filter(([key]) => ALLOWED_QUERY_PARAMS.includes(key)),
  );

  for (const [key, value] of Object.entries(filteredQuery)) {
    url.searchParams.set(key, value);
  }
}

export function setupRawRoutes(app: Hono<{
  Bindings: CloudflareBindings;
}>) {
  app.get(
    "/raw",
    cache({
      cacheName,
      cacheControl,
    }),
    async (c) => {
      const query = c.req.query();
      const url = new URL("", "https://unicode.org/Public/");

      setQueryParams(url, query);

      const urlString = decodeURIComponent(url.toString());

      const response = await fetch(urlString);

      if (!response.ok) {
        throw new HTTPException(response.status as ContentfulStatusCode, {
          message: `failed to fetch raw: ${response.statusText}`,
        });
      }

      const transformed = transformHtml(response);

      return c.newResponse(transformed.body, transformed.status as ContentfulStatusCode, {
        "Content-Type": transformed.headers.get("content-type") ?? "application/octet-stream",
      });
    },
  );

  app.get(
    "/raw/:path{.*}",
    cache({
      cacheName,
      cacheControl,
    }),
    async (c) => {
      const path = c.req.param("path");
      const query = c.req.query();
      const url = new URL(path, "https://unicode.org/Public/");

      setQueryParams(url, query);

      const urlString = decodeURIComponent(url.toString());

      const response = await fetch(urlString);

      if (!response.ok) {
        throw new HTTPException(response.status as ContentfulStatusCode, {
          message: `failed to fetch raw: ${response.statusText}`,
        });
      }

      if (response.headers.get("content-type")?.includes("text/html")) {
        const transformed = transformHtml(response, path);

        return c.newResponse(transformed.body, transformed.status as ContentfulStatusCode, {
          "Content-Type": "text/html",
        });
      }

      return c.newResponse(response.body, response.status as ContentfulStatusCode, {
        "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      });
    },
  );
}
