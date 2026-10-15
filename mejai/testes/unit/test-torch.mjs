import test from "node:test";
import assert from "node:assert/strict";
import { searchTorch, torchResults, torchSearchURL } from "../../src/services/torch-search.mjs";
const config = {
  baseURL: "http://torchsfe235y6d7wguqo6g4ucxqq7frrm5fpgkjssdhthsq4kjmmisid.onion/",
};
test("Torch URL encodes query and accepts only configured onion endpoints", () => {
  const address = new URL(torchSearchURL(config, " privacy & Tor "));
  assert.equal(address.pathname, "/search/");
  assert.equal(address.searchParams.get("q"), "privacy & Tor");
  assert.throws(() => torchSearchURL({ baseURL: "https://example.org" }, "query"));
  assert.throws(() => torchSearchURL(config, ""));
});
test("Torch extraction deduplicates observed onion links and excludes ads and internal navigation", () => {
  const target = "http://" + "a".repeat(56) + ".onion/page";
  const result = torchResults(
    [
      { title: "Result", url: target },
      { title: "Duplicate", url: target },
      { title: "Ad", url: target + "?ad", advertisement: true },
      { title: "Unsafe", url: "javascript:alert(1)" },
      { title: "Home", url: config.baseURL },
      { title: "Clearnet", url: "https://example.org" },
    ],
    config.baseURL,
  );
  assert.deepEqual(result, [{ title: "Result", url: target }]);
});
test("No proxy means no browser launch or direct query", async () => {
  await assert.rejects(
    searchTorch(
      {
        newPage() {
          throw Error("must not launch");
        },
      },
      { query: "test" },
      config,
    ),
    /tor-browser/,
  );
});
test("Torch failure retains page and never tries another engine", async () => {
  let attempts = 0;
  const page = {
    async goto() {
      attempts++;
      throw Error("offline");
    },
    url() {
      return config.baseURL;
    },
  };
  const result = await searchTorch(
    {
      async newPage() {
        return page;
      },
    },
    { query: "test" },
    config,
    "socks5://127.0.0.1:9050",
  );
  assert.equal(attempts, 1);
  assert.equal(result.engine, "torch");
  assert.equal(result.results.length, 0);
  assert.match(result.attempts[0].error, /offline/);
});

test("Torch's observed redirect links expose their onion target without visiting it", () => {
  const destination = "http://" + "b".repeat(56) + ".onion/docs";
  const redirect = new URL("/search/redirect", config.baseURL);
  redirect.searchParams.set("redirect_url", destination);
  assert.deepEqual(torchResults([{ title: "Documentation", url: redirect.href }], config.baseURL), [
    { title: "Documentation", url: destination },
  ]);
  redirect.searchParams.set("redirect_url", "javascript:alert(1)");
  assert.equal(torchResults([{ title: "Unsafe", url: redirect.href }], config.baseURL).length, 0);
});
