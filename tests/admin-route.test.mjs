import assert from "node:assert/strict";
import test from "node:test";

const appUrl = new URL(
  process.env.GRACE_SOCIAL_WALL_BASE_URL ?? "http://localhost:3000",
);

test("the root route redirects to the admin dashboard", async () => {
  const response = await fetch(new URL("/", appUrl), { redirect: "manual" });

  assert.equal(response.status, 307);
  assert.equal(
    new URL(response.headers.get("location"), appUrl).pathname,
    "/admin",
  );
});

test("unauthenticated admin access redirects to login", async () => {
  const response = await fetch(new URL("/admin", appUrl), {
    redirect: "manual",
  });

  assert.equal(response.status, 307);
  assert.equal(
    new URL(response.headers.get("location"), appUrl).pathname,
    "/login",
  );
});
