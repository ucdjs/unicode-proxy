import type { ContentfulStatusCode } from "hono/utils/http-status";
import { parse } from "apache-autoindex-parse";
import { HTTPException } from "hono/http-exception";

function trimTrailingSlash(path: string) {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export async function parseUnicodeDirectory(path: string = "") {
  const url = path ? `https://unicode.org/Public/${path}?F=2` : "https://unicode.org/Public?F=2";
  const response = await fetch(url);

  if (!response.ok) {
    throw new HTTPException(response.status as ContentfulStatusCode, {
      message: response.statusText,
    });
  }

  const html = await response.text();
  const files = parse(html, "F2");

  if (!files) {
    throw new HTTPException(500, {
      message: "Failed to parse the directory listing",
    });
  }

  return {
    files: files.children.map(({ type, name, path, lastModified }) => ({
      type,
      name: trimTrailingSlash(name),
      path: trimTrailingSlash(path),
      lastModified,
    })),
    lastModified: response.headers.get("Last-Modified") ?? "",
  };
}
