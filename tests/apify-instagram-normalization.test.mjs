import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function loadTypeScriptModule(path, replacements = []) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  source = source.replace(/^import "server-only";\s*/m, "");
  for (const [from, to] of replacements) {
    source = source.replaceAll(from, to);
  }
  const javascript = ts
    .transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })
    .outputText;
  const url = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
  return { url, module: await import(url) };
}

const graphApi = await loadTypeScriptModule(
  "../src/lib/instagram/graph-api.ts",
);
const providerContract = await loadTypeScriptModule(
  "../src/lib/instagram/provider-contract.ts",
);
const apifyProvider = await loadTypeScriptModule(
  "../src/lib/instagram/apify-provider.ts",
  [
    ['from "./graph-api"', `from "${graphApi.url}"`],
    ['from "./provider-contract"', `from "${providerContract.url}"`],
  ],
);

function configureToken() {
  const previous = process.env.APIFY_API_TOKEN;
  process.env.APIFY_API_TOKEN = "test-only-apify-token";
  return () => {
    if (previous === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = previous;
  };
}

function successfulRunResponse() {
  return Response.json(
    {
      data: {
        id: "run123",
        status: "SUCCEEDED",
        defaultDatasetId: "dataset123",
      },
    },
    { status: 201 },
  );
}

test("returns a valid empty result for an empty dataset", () => {
  const result = apifyProvider.module.normalizeApifyDataset(
    [],
    "birthday",
    "24h",
  );
  assert.equal(result.provider, "apify");
  assert.equal(result.hashtag, "birthday");
  assert.deepEqual(result.media, []);
});

test("rejects a non-dataset Apify response", () => {
  assert.throws(
    () =>
      apifyProvider.module.normalizeApifyDataset(
        { data: [] },
        "birthday",
        "24h",
      ),
    /unexpected dataset response/i,
  );
});

test("starts one bounded run with each configured date filter", async () => {
  const restoreToken = configureToken();
  const originalFetch = globalThis.fetch;
  const actorInputs = [];
  const datasetRequests = [];
  let runCount = 0;

  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    assert.equal(url.searchParams.has("token"), false);
    assert.equal(init.headers.Authorization, "Bearer test-only-apify-token");

    if (init.method === "POST") {
      runCount += 1;
      const requestBody = JSON.parse(init.body);
      assert.equal(url.pathname, "/v2/actors/apify~instagram-scraper/runs");
      assert.equal(url.searchParams.get("timeout"), "45");
      assert.equal(url.searchParams.get("maxTotalChargeUsd"), "0.5");
      assert.equal(url.searchParams.get("restartOnError"), "false");
      assert.equal(requestBody.resultsType, "posts");
      assert.equal(requestBody.resultsLimit, 30);
      assert.equal(requestBody.addParentData, false);
      actorInputs.push({
        hashtagUrl: requestBody.directUrls[0],
        dateFilter: requestBody.onlyPostsNewerThan,
      });
      return successfulRunResponse();
    }

    datasetRequests.push(url);
    return Response.json([], {
      headers: { "X-Apify-Pagination-Total": "0" },
    });
  };

  try {
    for (const [hashtag, dateRange] of [
      ["technology", "24h"],
      ["birthday", "7d"],
      ["wedding", "30d"],
    ]) {
      const result =
        await apifyProvider.module.apifyInstagramProvider.search({
          hashtag,
          dateRange,
          page: "initial",
        });
      assert.equal(result.provider, "apify");
      assert.deepEqual(result.media, []);
      assert.deepEqual(result.pagination, {
        recentAfter: null,
        topAfter: null,
      });
    }

    assert.equal(runCount, 3);
    assert.deepEqual(actorInputs, [
      {
        hashtagUrl: "https://www.instagram.com/explore/tags/technology/",
        dateFilter: "24 hours",
      },
      {
        hashtagUrl: "https://www.instagram.com/explore/tags/birthday/",
        dateFilter: "7 days",
      },
      {
        hashtagUrl: "https://www.instagram.com/explore/tags/wedding/",
        dateFilter: "30 days",
      },
    ]);
    assert.equal(datasetRequests.length, 3);
    for (const url of datasetRequests) {
      assert.match(url.pathname, /\/v2\/datasets\/dataset123\/items$/u);
      assert.equal(url.searchParams.get("offset"), "0");
      assert.equal(url.searchParams.get("limit"), "11");
      assert.equal(url.searchParams.get("desc"), "true");
    }
  } finally {
    globalThis.fetch = originalFetch;
    restoreToken();
  }
});

test("continues from the retained dataset without starting another run", async () => {
  const restoreToken = configureToken();
  const originalFetch = globalThis.fetch;
  let runCount = 0;
  const datasetOffsets = [];

  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    assert.equal(init.headers.Authorization, "Bearer test-only-apify-token");
    if (init.method === "POST") {
      runCount += 1;
      return successfulRunResponse();
    }

    datasetOffsets.push(url.searchParams.get("offset"));
    return Response.json([], {
      headers: { "X-Apify-Pagination-Total": "20" },
    });
  };

  try {
    const firstPage =
      await apifyProvider.module.apifyInstagramProvider.search({
        hashtag: "technology",
        dateRange: "30d",
        page: "initial",
      });
    const cursor = firstPage.pagination.recentAfter;

    assert.ok(cursor);
    assert.equal(cursor.includes("dataset123"), false);
    assert.equal(firstPage.pagination.topAfter, cursor);

    const secondPage =
      await apifyProvider.module.apifyInstagramProvider.search({
        hashtag: "technology",
        dateRange: "30d",
        page: "next",
        recentAfter: cursor,
        topAfter: cursor,
      });

    assert.equal(runCount, 1);
    assert.deepEqual(datasetOffsets, ["0", "10"]);
    assert.equal(secondPage.pagination.recentAfter, null);
    assert.equal(secondPage.pagination.topAfter, null);
  } finally {
    globalThis.fetch = originalFetch;
    restoreToken();
  }
});

test("coalesces concurrent identical searches", async () => {
  const restoreToken = configureToken();
  const originalFetch = globalThis.fetch;
  let runCount = 0;
  let datasetReadCount = 0;
  globalThis.fetch = async (_input, init) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (init.method === "POST") {
      runCount += 1;
      return successfulRunResponse();
    }
    datasetReadCount += 1;
    return Response.json([], {
      headers: { "X-Apify-Pagination-Total": "0" },
    });
  };

  try {
    const input = {
      hashtag: "technology",
      dateRange: "24h",
      page: "initial",
    };
    const [first, second] = await Promise.all([
      apifyProvider.module.apifyInstagramProvider.search(input),
      apifyProvider.module.apifyInstagramProvider.search(input),
    ]);
    assert.equal(runCount, 1);
    assert.equal(datasetReadCount, 1);
    assert.strictEqual(first, second);
  } finally {
    globalThis.fetch = originalFetch;
    restoreToken();
  }
});

test("does not retry or expose credentials on Apify rate limits", async () => {
  const restoreToken = configureToken();
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return Response.json({ error: "limited" }, { status: 429 });
  };

  try {
    await assert.rejects(
      apifyProvider.module.apifyInstagramProvider.search({
        hashtag: "wedding",
        dateRange: "30d",
        page: "initial",
      }),
      (error) => {
        assert.equal(error.httpStatus, 429);
        assert.match(error.message, /rate limit/i);
        assert.doesNotMatch(error.message, /test-only-apify-token/);
        return true;
      },
    );
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreToken();
  }
});
