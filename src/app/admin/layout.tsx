import { Suspense } from "react";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { isLocalDevelopmentAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { requireAdmin } from "@/lib/auth/admin";

async function AdminContent({ children }: { children: ReactNode }) {
  if (!isLocalDevelopmentAuthBypassEnabled()) {
    await connection();
    await requireAdmin();
  }

  return children;
}

function AdminLoading() {
  return (
    <main className="admin-loading" aria-label="Loading dashboard">
      <span className="loading-spinner" />
      <p>Loading your workspace…</p>
    </main>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminContent>{children}</AdminContent>
    </Suspense>
  );
}
