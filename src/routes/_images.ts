import type { Hono } from "hono";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";

const cacheName = "unicode-proxy-images";
const cacheControl = "max-age=604800";

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

      return c.newResponse(response.body, 200, {
        "Content-Type": "image/png",
      });
    },
  );
}
