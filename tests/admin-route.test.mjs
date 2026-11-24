import assert from "node:assert/strict";
import test from "node:test";

const appUrl = new URL(
  process.env.GRACE_SOCIAL_WALL_BASE_URL ?? "http://localhost:3000",
);

test("the root route redirects to the public demo", async () => {
  const response = await fetch(new URL("/", appUrl), { redirect: "manual" });

  assert.equal(response.status, 307);
  assert.equal(
    new URL(response.headers.get("location"), appUrl).pathname,
    "/demo",
  );
});

test("the demo route is publicly accessible", async () => {
  const response = await fetch(new URL("/demo", appUrl));
  const page = await response.text();

  assert.equal(response.status, 200);
  assert.match(page, /Live API demo/);
  assert.match(page, /Instagram hashtag discovery/i);
});

test("unauthenticated admin access redirects away from protected pages", async () => {
  const response = await fetch(new URL("/admin", appUrl), {
    redirect: "manual",
  });

  assert.equal(response.status, 307);
  assert.ok(
    ["/demo", "/login"].includes(
      new URL(response.headers.get("location"), appUrl).pathname,
    ),
  );
});
