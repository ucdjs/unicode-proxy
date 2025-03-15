import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { expect, it } from "vitest";
import worker from "../src";

it("respond with a 404", async () => {
  const request = new Request("https://unicode-proxy.mojis.dev/not-found");
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    message: "Not found",
    status: 404,
    path: "/not-found",
    timestamp: expect.any(String),
  });
});

it("should return directory listing for root proxy path", async () => {
  const request = new Request("https://unicode-proxy.mojis.dev/proxy");
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(Array.isArray(data)).toBe(true);
  expect(data[0]).toMatchObject({
    type: expect.any(String),
    name: expect.any(String),
    path: expect.any(String),
  });
});

it("should return directory listing for nested directory", async () => {
  const request = new Request("https://unicode-proxy.mojis.dev/proxy/emoji");
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(Array.isArray(data)).toBe(true);
  expect(data[0]).toMatchObject({
    type: expect.any(String),
    name: expect.any(String),
    path: expect.any(String),
  });
});

it("should return file contents for specific file", async () => {
  const request = new Request("https://unicode-proxy.mojis.dev/proxy/emoji/16.0/emoji-test.txt");
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toMatch(/text\/plain/);
  const text = await response.text();
  expect(text).toMatch(/emoji/i);
});

it("should handle 404 for non-existent paths", async () => {
  const request = new Request("https://unicode-proxy.mojis.dev/proxy/not-a-real-path");
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    message: "Not Found",
    status: 404,
    path: "/proxy/not-a-real-path",
    timestamp: expect.any(String),
  });
});
