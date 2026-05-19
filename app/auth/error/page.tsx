import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

type AuthErrorPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  "access-denied": "Your Vercel account is not on the access list for this app.",
  "callback-failed": "Vercel could not complete the sign-in flow.",
  configuration: "The app is missing its Vercel sign-in configuration.",
  denied: "The Vercel sign-in request was cancelled.",
  "invalid-callback": "The Vercel sign-in response could not be verified.",
};

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const { reason } = await searchParams;
  const message =
    ERROR_MESSAGES[reason ?? ""] ?? "An unexpected authentication error occurred.";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Workflow Tracker
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Sign-in failed
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <Link
          className={buttonVariants({ className: "mt-6 w-full" })}
          href="/sign-in"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
