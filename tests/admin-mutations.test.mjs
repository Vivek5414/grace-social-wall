import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/admin/mutations.ts", import.meta.url),
  "utf8",
);
const javascript = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { createAdminMutationActions } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);

const adminId = "25414b37-8f07-4e3c-8666-e4d6e4dd0d0e";
const hashtagId = "04459593-2d64-4da4-8fc0-6b6168a242da";
const postId = "82e2ec00-7ca6-482b-9d6d-db70376efba6";

function makeModerationResult(status) {
  return {
    post: {
      id: postId,
      platform: "instagram",
      author_name: "Test author",
      caption: "Fictional test post",
      approval_status: status,
      approved_at: status === "approved" ? "2026-11-23T00:00:00Z" : null,
    },
    activity: {
      id: "cb0fa852-2e67-43d3-afea-66c71b53fa35",
      post_id: postId,
      admin_user_id: adminId,
      action: status,
      notes: null,
      created_at: "2026-11-23T00:00:00Z",
    },
  };
}

function makeHarness({ authorize, overrides = {} } = {}) {
  const calls = [];
  let revalidated = 0;
  const repository = {
    async createHashtag(value) {
      calls.push(["createHashtag", value]);
      return {
        data: {
          id: hashtagId,
          hashtag: value,
          is_active: true,
          created_at: "2026-11-23T00:00:00Z",
        },
        error: null,
      };
    },
    async updateHashtag(id, changes) {
      calls.push(["updateHashtag", id, changes]);
      return {
        data: {
          id,
          hashtag: changes.hashtag ?? "#Test",
          is_active: changes.is_active ?? true,
          created_at: "2026-11-23T00:00:00Z",
        },
        error: null,
      };
    },
    async deleteHashtag(id) {
      calls.push(["deleteHashtag", id]);
      return { data: { id }, error: null };
    },
    async moderatePost(id, status) {
      calls.push(["moderatePost", id, status]);
      return { data: makeModerationResult(status), error: null };
    },
    ...overrides,
  };
  const actions = createAdminMutationActions({
    authorize: authorize ?? (async () => ({ id: adminId })),
    createRepository: async () => repository,
    revalidate: () => {
      revalidated += 1;
    },
  });

  return {
    actions,
    calls,
    repository,
    get revalidated() {
      return revalidated;
    },
  };
}

test("adds a trimmed hashtag and returns the persisted record", async () => {
  const harness = makeHarness();
  const result = await harness.actions.createHashtagAction("  #NewTag  ");

  assert.equal(result.success, true);
  assert.equal(result.data.hashtag, "#NewTag");
  assert.deepEqual(harness.calls, [["createHashtag", "#NewTag"]]);
  assert.equal(harness.revalidated, 1);
});

test("edits a hashtag by UUID", async () => {
  const harness = makeHarness();
  const result = await harness.actions.updateHashtagAction(
    hashtagId,
    "#Edited",
  );

  assert.equal(result.success, true);
  assert.deepEqual(harness.calls, [
    ["updateHashtag", hashtagId, { hashtag: "#Edited" }],
  ]);
});

for (const isActive of [true, false]) {
  test(`${isActive ? "activates" : "deactivates"} a hashtag by UUID`, async () => {
    const harness = makeHarness();
    const result = await harness.actions.setHashtagActiveAction(
      hashtagId,
      isActive,
    );

    assert.equal(result.success, true);
    assert.equal(result.data.isActive, isActive);
    assert.deepEqual(harness.calls, [
      ["updateHashtag", hashtagId, { is_active: isActive }],
    ]);
  });
}

for (const status of ["approved", "rejected", "removed"]) {
  test(`${status} post returns its status and moderation log`, async () => {
    const harness = makeHarness();
    const result = await harness.actions.reviewPostAction(postId, status);

    assert.equal(result.success, true);
    assert.equal(result.data.approvalStatus, status);
    assert.equal(result.data.activity.action, status);
    assert.equal(result.data.activity.adminUserId, adminId);
    assert.deepEqual(harness.calls, [["moderatePost", postId, status]]);
    assert.equal(harness.revalidated, 1);
  });
}

test("does not report success when the moderation repository rejects", async () => {
  const harness = makeHarness({
    overrides: {
      async moderatePost() {
        return {
          data: null,
          error: {
            code: "42501",
            message: "permission denied",
          },
        };
      },
    },
  });

  const result = await harness.actions.reviewPostAction(postId, "approved");

  assert.equal(result.success, false);
  assert.equal(harness.revalidated, 0);
});

test("does not call database operations when administrator authorization fails", async () => {
  const harness = makeHarness({
    authorize: async () => {
      throw new Error("not authorized");
    },
  });

  const operations = [
    () => harness.actions.createHashtagAction("#Denied"),
    () => harness.actions.updateHashtagAction(hashtagId, "#Denied"),
    () => harness.actions.setHashtagActiveAction(hashtagId, false),
    () => harness.actions.deleteHashtagAction(hashtagId),
    () => harness.actions.reviewPostAction(postId, "approved"),
  ];

  for (const operation of operations) {
    await assert.rejects(operation, /not authorized/);
  }
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.revalidated, 0);
});
