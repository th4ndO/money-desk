import { afterEach, describe, expect, it, vi } from "vitest";
import { skewTolerantFetch } from "./fetch";

const skew = () => new Response('{"code":"PGRST303","message":"JWT issued at future"}', { status: 401 });

describe("skewTolerantFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retries a 'JWT issued at future' error and returns the good response", async () => {
    vi.useFakeTimers();
    const mock = vi.fn().mockResolvedValueOnce(skew()).mockResolvedValueOnce(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const p = skewTolerantFetch("https://x/rest/v1/t", { method: "POST", body: "{}" });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls[1][1]).toEqual({ method: "POST", body: "{}" });
    vi.useRealTimers();
  });

  it("does not retry other 401s or successes", async () => {
    const mock = vi.fn().mockResolvedValue(new Response('{"code":"PGRST301"}', { status: 401 }));
    vi.stubGlobal("fetch", mock);
    expect((await skewTolerantFetch("https://x")).status).toBe(401);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("gives up after two retries", async () => {
    vi.useFakeTimers();
    const mock = vi.fn().mockImplementation(async () => skew());
    vi.stubGlobal("fetch", mock);
    const p = skewTolerantFetch("https://x");
    await vi.runAllTimersAsync();
    expect((await p).status).toBe(401);
    expect(mock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
