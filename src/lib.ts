import { parse } from "apache-autoindex-parse";
import { HTTPException } from "hono/http-exception";

function trimTrailingSlash(path: string) {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export async function parseUnicodeDirectory(html: string) {
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
  };
}
