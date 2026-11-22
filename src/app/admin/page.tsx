import { Suspense } from "react";
import { connection } from "next/server";
import Dashboard from "@/components/dashboard/Dashboard";
import { getAdminDashboardData } from "@/lib/dashboard/data";

async function AdminDashboard() {
  await connection();
  const data = await getAdminDashboardData();
  return <Dashboard initialData={data} />;
}

function DashboardLoading() {
  return (
    <main className="admin-loading" aria-label="Loading dashboard">
      <span className="loading-spinner" />
      <p>Loading your workspace…</p>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <AdminDashboard />
    </Suspense>
  );
}
