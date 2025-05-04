import type { Context, MiddlewareHandler } from "hono";

// Taken from https://github.com/honojs/hono/blob/main/src/middleware/cache/index.ts
// but modified to support SWR.

export function cache(options: {
  cacheName: string | ((c: Context) => Promise<string> | string);
  wait?: boolean;
  cacheControl?: string;
  vary?: string | string[];
  keyGenerator?: (c: Context) => Promise<string> | string;
  cacheControlHeader?: string;
}): MiddlewareHandler {
  if (!("caches" in globalThis)) {
    // eslint-disable-next-line no-console
    console.log("Cache Middleware is not enabled because caches is not defined.");
    return async (_c, next) => await next();
  }

  if (options.wait === undefined) {
    options.wait = false;
  }

  const cacheControlHeader = options.cacheControlHeader || "cache-control";

  const cacheControlDirectives = options.cacheControl
    ?.split(",")
    .map((directive) => directive.toLowerCase());
  const varyDirectives = Array.isArray(options.vary)
    ? options.vary
    : options.vary?.split(",").map((directive) => directive.trim());
  // RFC 7231 Section 7.1.4 specifies that "*" is not allowed in Vary header.
  // See: https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.4
  if (options.vary?.includes("*")) {
    throw new Error(
      "Middleware vary configuration cannot include \"*\", as it disallows effective caching.",
    );
  }

  const addHeader = (c: Context) => {
    if (cacheControlDirectives) {
      const existingDirectives
        = c.res.headers
          .get("Cache-Control")
          ?.split(",")
          .map((d) => d.trim().split("=", 1)[0]) ?? [];
      for (const directive of cacheControlDirectives) {
        let [name, value] = directive.trim().split("=", 2);
        name = name.toLowerCase();
        if (!existingDirectives.includes(name)) {
          c.header("Cache-Control", `${name}${value ? `=${value}` : ""}`, { append: true });
        }
      }
    }

    if (varyDirectives) {
      const existingDirectives
        = c.res.headers
          .get("Vary")
          ?.split(",")
          .map((d) => d.trim()) ?? [];

      const vary = Array.from(
        new Set(
          [...existingDirectives, ...varyDirectives].map((directive) => directive.toLowerCase()),
        ),
      ).sort();

      if (vary.includes("*")) {
        c.header("Vary", "*");
      } else {
        c.header("Vary", vary.join(", "));
      }
    }
  };

  const parseCacheControl = (header: string): Record<string, number | boolean | string> => {
    const directives: Record<string, number | boolean | string> = {};
    const parts = header.split(",");

    for (const part of parts) {
      const [key, value] = part.trim().split("=", 2);
      if (value) {
        const numValue = Number.parseInt(value, 10);
        directives[key.toLowerCase()] = Number.isNaN(numValue) ? value : numValue;
      } else {
        directives[key.toLowerCase()] = true;
      }
    }

    return directives;
  };

  const shouldRevalidate = (cachedResponse: Response): boolean => {
    const ageHeader = cachedResponse.headers.get("age");
    const cacheControl = cachedResponse.headers.get(cacheControlHeader);

    if (!ageHeader || !cacheControl) {
      return false;
    }

    const parsed = parseCacheControl(cacheControl);
    const staleWhileRevalidate = parsed["stale-while-revalidate"] as number | undefined;
    const maxAge = parsed["max-age"] as number | undefined;

    if (typeof staleWhileRevalidate === "undefined" || typeof maxAge === "undefined") {
      return false;
    }

    const age = Number(ageHeader);
    if (Number.isNaN(age)) {
      return false;
    }

    // Check if content is stale but within the stale-while-revalidate window
    return age > maxAge && age <= (maxAge + staleWhileRevalidate);
  };

  return async function cache(c, next) {
    let key = c.req.url;
    if (options.keyGenerator) {
      key = await options.keyGenerator(c);
    }

    const cacheName
      = typeof options.cacheName === "function" ? await options.cacheName(c) : options.cacheName;
    const cache = await caches.open(cacheName);
    const response = await cache.match(key);

    if (response) {
      // check if we should revalidate (stale-while-revalidate)
      if (shouldRevalidate(response)) {
        // eslint-disable-next-line no-console
        console.log("Cache: REVALIDATE (stale-while-revalidate)");

        // clone the cached response for immediate return
        const responseToReturn = response.clone();

        // revalidate in the background
        const revalidate = async () => {
          await next();

          if (c.res.ok) {
            addHeader(c);
            const res = c.res.clone();
            await cache.put(key, res);
          }
        };

        if (options.wait) {
          await revalidate();
        } else {
          c.executionCtx.waitUntil(revalidate());
        }

        // return the stale cached response immediately
        return new Response(responseToReturn.body, responseToReturn);
      }

      // if not revalidating, return cached response directly
      return new Response(response.body, response);
    }

    // cache miss - proceed with request
    await next();
    if (!c.res.ok) {
      return;
    }
    addHeader(c);
    const res = c.res.clone();
    if (options.wait) {
      await cache.put(key, res);
    } else {
      c.executionCtx.waitUntil(cache.put(key, res));
    }
  };
}
