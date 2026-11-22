import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    if (authError.name === "AuthSessionMissingError") {
      return null;
    }

    throw new Error("Unable to verify the current Supabase session.", {
      cause: authError,
    });
  }

  if (!authData.user) {
    return null;
  }

  const { data: adminRecord, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (adminError) {
    throw new Error("Unable to verify administrator access.", {
      cause: adminError,
    });
  }

  return adminRecord ? authData.user : null;
}

export async function requireAdmin(): Promise<User> {
  const user = await getAdminUser();

  if (!user) {
    redirect("/login?error=not-admin");
  }

  return user;
}
