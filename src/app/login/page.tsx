import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  "not-allowed": "That account isn't allowed to use Money Desk. You've been signed out.",
  "link-expired": "That sign-in link has expired or was already used. Send a new one.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const notice = typeof error === "string" ? NOTICES[error] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Money Desk</h1>
      <p className="mt-1 mb-8 text-muted">Enter your PIN to open your money.</p>
      <LoginForm notice={notice} />
    </main>
  );
}
