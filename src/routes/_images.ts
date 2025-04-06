import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";

const cacheName = "unicode-proxy-images";
const cacheControl = "max-age=604800";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/svg+xml", "image/gif", "image/jpeg", "image/webp"];

export function setupImagesRoutes(app: Hono<{
  Bindings: CloudflareBindings;
}>) {
  app.get(
    "/_images",
    cache({
      cacheName,
      cacheControl,
    }),
    async (c) => {
      const iconPath = c.req.query("icon");

      if (!iconPath) {
        throw new HTTPException(400, {
          message: "icon is required",
        });
      }

      const response = await fetch(`https://unicode.org/${iconPath}`);

      if (!response.ok) {
        throw new HTTPException(response.status as ContentfulStatusCode, {
          message: `failed to fetch image: ${response.statusText}`,
        });
      }

      if (!ALLOWED_IMAGE_TYPES.includes(response.headers.get("content-type") ?? "")) {
        throw new HTTPException(400, {
          message: "invalid image type",
        });
      }

      return c.newResponse(response.body, response.status as ContentfulStatusCode, {
        "Content-Type": response.headers.get("content-type") ?? "image/png",
      });
    },
  );
}
