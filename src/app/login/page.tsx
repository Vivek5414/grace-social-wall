import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { hasSupabasePublicConfig } from "@/lib/supabase/env";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign in | Grace Social Wall",
  description: "Sign in to the Grace Social Wall administrator workspace.",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string | string[] }>;
}

async function LoginPageForm({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const notAdmin = error === "not-admin";

  return <LoginForm key={notAdmin ? "not-admin" : "login"} notAdmin={notAdmin} />;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  if (!hasSupabasePublicConfig()) {
    redirect("/demo");
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brand}>
          <Image
            src="/grace-technologies-logo.png"
            alt="Grace Technologies"
            width={56}
            height={56}
            className={styles.logo}
            preload
          />
          <div>
            <p className={styles.brandName}>Grace Technologies</p>
            <p className={styles.productName}>Grace Social Wall</p>
          </div>
        </div>

        <div className={styles.intro}>
          <p className={styles.eyebrow}>Administrator workspace</p>
          <h1 id="login-title">Welcome back</h1>
          <p className={styles.subtitle}>
            Sign in to manage and moderate your social wall.
          </p>
        </div>

        <Suspense fallback={<LoginForm notAdmin={false} />}>
          <LoginPageForm searchParams={searchParams} />
        </Suspense>

        <div className={styles.accessNote}>
          <span className={styles.accessMark} aria-hidden="true">G</span>
          <p>
            <strong>Private administrator access</strong>
            Access is provisioned by your workspace administrator.
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        Grace Technologies
        <span aria-hidden="true">·</span>
        Secure administrator sign-in
      </footer>
    </main>
  );
}
