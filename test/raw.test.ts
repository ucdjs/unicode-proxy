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

describe("raw", () => {
  it("should return raw response", async () => {
    fetchMock
      .get("https://unicode.org")
      .intercept({ path: "/Public/" })
      .reply(200, "Hello, World!", {
        headers: {
          "Content-Type": "text/html",
        },
      });

    const request = new Request("https://unicode-proxy.mojis.dev/raw");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Hello, World!");
  });

  it("should allow changing format", async () => {
    fetchMock
      .get("https://unicode.org")
      .intercept({ path: "/Public/?F=F1" })
      .reply(({ path }) => {
        const url = new URL(path, "https://unicode.org");
        return {
          statusCode: 200,
          data: `Hello, World! Format: ${url.searchParams.get("F")}`,
        };
      });

    const request = new Request("https://unicode-proxy.mojis.dev/raw?F=F1");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Hello, World! Format: F1");
  });

  it("should allow changing order", async () => {
    fetchMock
      .get("https://unicode.org")
      .intercept({ path: "/Public/?O=A" })
      .reply(({ path }) => {
        const url = new URL(path, "https://unicode.org");
        return {
          statusCode: 200,
          data: `Hello, World! Order: ${url.searchParams.get("O")}`,
        };
      });

    const request = new Request("https://unicode-proxy.mojis.dev/raw?O=A");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Hello, World! Order: A");
  });

  it("should allow changing version", async () => {
    fetchMock
      .get("https://unicode.org")
      .intercept({ path: "/Public/?V=15.1" })
      .reply(({ path }) => {
        const url = new URL(path, "https://unicode.org");
        return {
          statusCode: 200,
          data: `Hello, World! Version: ${url.searchParams.get("V")}`,
        };
      });

    const request = new Request("https://unicode-proxy.mojis.dev/raw?V=15.1");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Hello, World! Version: 15.1");
  });

  it("should return file when path is a file", async () => {
    fetchMock
      .get("https://unicode.org")
      .intercept({ path: "/Public/emoji/15.1/emoji-test.txt" })
      .reply(200, "Hello, World!");

    const request = new Request("https://unicode-proxy.mojis.dev/raw/emoji/15.1/emoji-test.txt");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello, World!");
  });

  it("should return 404 when file is not found", async () => {
    fetchMock
      .get("https://unicode.org")
      .intercept({ path: "/Public/emoji/15.1/emoji-test.txt" })
      .reply(404, "Not Found");

    const request = new Request("https://unicode-proxy.mojis.dev/raw/emoji/15.1/emoji-test.txt");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      message: "failed to fetch raw: Not Found",
      status: 404,
      path: "/raw/emoji/15.1/emoji-test.txt",
      timestamp: expect.any(String),
    });
  });
});
