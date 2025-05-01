import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";

const cacheName = "unicode-proxy-versions";
const cacheControl = "max-age=3600";

interface UnicodeVersion {
  version: string;
  documentationUrl: string;
  ucdUrl: string;
  date: string;
}

export function setupVersionRoutes(app: Hono<{
  Bindings: CloudflareBindings;
}>) {
  app.get(
    "/versions",
    cache({
      cacheName,
      cacheControl,
    }),
    async (c) => {
      const response = await fetch("https://www.unicode.org/versions/enumeratedversions.html");
      if (!response.ok) {
        throw new HTTPException(response.status as ContentfulStatusCode, {
          message: `Failed to fetch Unicode versions: ${response.statusText}`,
        });
      }

      const html = await response.text();

      // find any table that contains Unicode version information
      const versionPattern = /Unicode \d+\.\d+\.\d+/;
      const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/g)?.find((table) =>
        versionPattern.test(table),
      );

      if (!tableMatch) {
        throw new HTTPException(404, { message: "Unicode versions table not found" });
      }

      const versions: UnicodeVersion[] = [];

      // match any row that contains a cell
      const rows = tableMatch.match(/<tr>[\s\S]*?<\/tr>/g) || [];

      for (const row of rows) {
        // look for Unicode version pattern in the row
        const versionMatch = row.match(new RegExp(`<a[^>]+href="([^"]+)"[^>]*>(${versionPattern.source})</a>`));
        if (!versionMatch) continue;

        const documentationUrl = versionMatch[1];
        const version = versionMatch[2].replace("Unicode ", "");

        // look for a year pattern anywhere in the row
        const dateMatch = row.match(/<td[^>]*>(\d{4})<\/td>/);
        if (!dateMatch) continue;

        versions.push({
          version,
          documentationUrl,
          date: dateMatch[1],
          ucdUrl: `https://www.unicode.org/Public/${version}/ucd`,
        });
      }

      if (versions.length === 0) {
        throw new HTTPException(500, {
          message: "Failed to parse any Unicode versions from the page",
        });
      }

      // sort versions by date in descending order
      versions.sort((a, b) => Number.parseInt(b.date) - Number.parseInt(a.date));

      return c.json(versions);
    },
  );
}
