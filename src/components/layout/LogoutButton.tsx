"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function handleLogout() {
    setError("");

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError("Sign out failed. Please try again.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Unable to reach the sign-in service. Please try again.");
    }
  }

  return (
    <div className="logout-control">
      <button
        type="button"
        className="icon-button logout-button"
        onClick={handleLogout}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut size={16} aria-hidden="true" />
      </button>
      {error && <span className="logout-error" role="alert">{error}</span>}
    </div>
  );
}
