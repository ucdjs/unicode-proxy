import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cache } from "hono/cache";

const cacheName = "unicode-proxy-raw";
const cacheControl = "max-age=3600";

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
      if (query.F) {
        url.searchParams.set("F", query.F);
      }

      if (query.C) {
        url.searchParams.set("C", query.C);
      }

      const urlString = decodeURIComponent(url.toString());

      const response = await fetch(urlString);

      const transformed = new HTMLRewriter()
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

            element.setAttribute("href", `/raw/${href}`);
          },
        }).transform(response);

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

      if (query.F) {
        url.searchParams.set("F", query.F);
      }

      if (query.C) {
        url.searchParams.set("C", query.C);
      }

      const urlString = decodeURIComponent(url.toString());

      const response = await fetch(urlString);

      if (response.headers.get("content-type")?.includes("text/html")) {
        const transformed = new HTMLRewriter()
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

              // we can assume that this is points to some root path
              // so /Public/ or /Public/emoji/
              // but since we use /raw/ instead of /Public/
              // we need to adjust the href
              if (href.startsWith("/")) {
                // if contains /Public/
                if (href.includes("/Public/")) {
                  href = href.replace("/Public/", "/");
                }

                element.setAttribute("href", `/raw${href}`);
                return;
              }

              // if it's not a root path, we can just append the href to the path
              element.setAttribute("href", `/raw/${path}/${href}`);
            },
          }).transform(response);

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
