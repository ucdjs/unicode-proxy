import type { HonoEnv } from "../types";
import { Hono } from "hono";
import { proxy } from "hono/proxy";

export const RAW_ROUTER = new Hono<HonoEnv>();

RAW_ROUTER.get("/:path", async (c) => {
  return proxy(`https://unicode.org/Public/${c.req.param("path")}`);
});
