export function isLocalDevelopmentAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.VERCEL &&
    !process.env.VERCEL_ENV &&
    process.env.GRACE_SOCIAL_WALL_DEV_AUTH_BYPASS === "true"
  );
}
