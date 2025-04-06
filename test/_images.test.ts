import {
  createExecutionContext,
  env,
  fetchMock,
  waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import worker from "../src";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("images", () => {
  it("should return a 400 if no icon is provided", async () => {
    const request = new Request("https://unicode-proxy.mojis.dev/_images");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: "icon is required",
      status: 400,
      path: "/_images",
      timestamp: expect.any(String),
    });
  });

  it("should return a 404 if the icon is not found", async () => {
    fetchMock
      .get("https://unicode.org")
      .intercept({ path: "/not-a-real-icon" })
      .reply(404, "body");

    const request = new Request("https://unicode-proxy.mojis.dev/_images?icon=not-a-real-icon");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      message: "icon not found",
      status: 404,
      path: "/_images?icon=not-a-real-icon",
      timestamp: expect.any(String),
    });
  });

  it("should return a 400 if the image type is not allowed", async () => {
    fetchMock
      .get("https://unicode.org")
      .intercept({ path: "/icon-with-disallowed-type" })
      .reply(200, "body", {
        headers: {
          "Content-Type": "text/plain",
        },
      });

    const request = new Request("https://unicode-proxy.mojis.dev/_images?icon=icon-with-disallowed-type");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: "invalid image type",
      status: 400,
      path: "/_images?icon=icon-with-disallowed-type",
      timestamp: expect.any(String),
    });
  });

  it("should return a 200 if the image type is allowed", async () => {
    fetchMock
      .get("https://unicode.org")
      .intercept({ path: "/icon-with-allowed-type" })
      .reply(200, "body", {
        headers: {
          "Content-Type": "image/png",
        },
      });

    const request = new Request("https://unicode-proxy.mojis.dev/_images?icon=icon-with-allowed-type");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });
});
