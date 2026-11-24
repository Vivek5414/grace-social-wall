import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/instagram/graph-api.ts", import.meta.url),
  "utf8",
);
const javascript = ts
  .transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  .outputText.replace(/^import "server-only";\s*/m, "");
const graphApi = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);

const environmentKeys = [
  "INSTAGRAM_ACCESS_TOKEN",
  "INSTAGRAM_USER_ID",
  "META_GRAPH_API_VERSION",
];

function configureTestEnvironment(token) {
  const previous = new Map(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  process.env.INSTAGRAM_ACCESS_TOKEN = token;
  process.env.INSTAGRAM_USER_ID = "17841463799146136";
  process.env.META_GRAPH_API_VERSION = "v27.0";
  return () => {
    for (const key of environmentKeys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test("reports sanitized hashtag-search diagnostics for an expired token", async () => {
  const token = "test-only-access-token";
  const restoreEnvironment = configureTestEnvironment(token);
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const logs = [];

  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/v27.0/ig_hashtag_search");
    assert.equal(url.searchParams.get("q"), "ai");
    assert.equal(url.searchParams.get("user_id"), "17841463799146136");
    assert.equal(url.searchParams.has("access_token"), false);
    assert.equal(init.headers.Authorization === `Bearer ${token}`, true);

    return Response.json(
      {
        error: {
          message: `Expired ${token}; https://graph.facebook.com/path?access_token=${token}`,
          code: 190,
          error_subcode: 463,
        },
      },
      { status: 401 },
    );
  };
  console.error = (...args) => logs.push(args);

  try {
    let caughtError;
    await assert.rejects(
      graphApi.discoverInstagramHashtag("ai", { page: "initial" }),
      (error) => {
        caughtError = error;
        return error instanceof graphApi.InstagramGraphApiError;
      },
    );

    assert.equal(caughtError.details.endpoint, "ig_hashtag_search");
    assert.equal(caughtError.details.httpStatus, 401);
    assert.equal(caughtError.details.metaCode, 190);
    assert.equal(caughtError.details.metaSubcode, 463);
    assert.equal(
      caughtError.details.metaMessage,
      "Expired [redacted]; [URL redacted]",
    );

    const publicMessage =
      graphApi.getInstagramGraphErrorMessage(caughtError);
    assert.match(publicMessage, /access token expired/i);
    assert.match(publicMessage, /ig_hashtag_search/);
    assert.doesNotMatch(publicMessage, new RegExp(token));
    assert.doesNotMatch(JSON.stringify(logs), new RegExp(token));
    assert.equal(logs[0][1].endpoint, "ig_hashtag_search");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    restoreEnvironment();
  }
});

test("logs a failed media edge and keeps posts without media URLs", async () => {
  const token = "test-only-media-token";
  const restoreEnvironment = configureTestEnvironment(token);
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const logs = [];

  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/ig_hashtag_search")) {
      return Response.json({ data: [{ id: "12345" }] });
    }
    if (url.pathname.endsWith("/recent_media")) {
      return Response.json(
        {
          error: {
            message: `Expired ${token}`,
            code: 190,
            error_subcode: 463,
          },
        },
        { status: 401 },
      );
    }
    if (url.pathname.endsWith("/top_media")) {
      return Response.json({
        data: [{ id: "post-without-url", media_type: "IMAGE" }],
      });
    }
    throw new Error("Unexpected test endpoint");
  };
  console.error = (...args) => logs.push(args);

  try {
    const result = await graphApi.discoverInstagramHashtag("ai", {
      page: "initial",
    });

    assert.equal(result.hashtagId, "12345");
    assert.equal(result.media.length, 1);
    assert.equal(result.media[0].mediaUrl, null);
    assert.match(result.warnings[0].message, /recent_media/);
    assert.match(result.warnings[0].message, /HTTP 401/);
    assert.doesNotMatch(result.warnings[0].message, new RegExp(token));
    assert.equal(logs[0][1].endpoint, "recent_media");
    assert.equal(logs[0][1].httpStatus, 401);
    assert.equal(logs[0][1].metaCode, 190);
    assert.equal(logs[0][1].metaSubcode, 463);
    assert.doesNotMatch(JSON.stringify(logs), new RegExp(token));
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    restoreEnvironment();
  }
});
