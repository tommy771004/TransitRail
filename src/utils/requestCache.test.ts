import { describe, expect, it, vi } from "vitest";
import { createPromiseCache } from "./requestCache";

describe("createPromiseCache", () => {
  it("shares one in-flight load between concurrent callers and reuses it until the TTL passes", async () => {
    let clock = 0;
    const cache = createPromiseCache<string>(1000, () => clock);
    const loader = vi.fn(async () => "value");

    const [a, b] = await Promise.all([cache.get("k", loader), cache.get("k", loader)]);
    expect(a).toBe("value");
    expect(b).toBe("value");
    expect(loader).toHaveBeenCalledTimes(1);

    clock = 999;
    await cache.get("k", loader);
    expect(loader).toHaveBeenCalledTimes(1);

    clock = 1000;
    await cache.get("k", loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("forgets a failed load so the next call retries", async () => {
    const cache = createPromiseCache<string>(60_000);
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.get("k", loader)).rejects.toThrow("offline");
    expect(cache.size()).toBe(0);
    await expect(cache.get("k", loader)).resolves.toBe("recovered");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("keeps keys apart and clears on demand", async () => {
    const cache = createPromiseCache<number>(60_000);
    await cache.get("a", async () => 1);
    await cache.get("b", async () => 2);
    expect(cache.size()).toBe(2);
    cache.clear("a");
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
