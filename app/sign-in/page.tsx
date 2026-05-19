import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getAuthUser, sanitizeRedirectPath } from "@/lib/auth";

type SignInPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const user = await getAuthUser();
  const { next } = await searchParams;
  const nextPath = sanitizeRedirectPath(next);

  if (user) {
    redirect(nextPath);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Workflow Tracker
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Sign in to continue
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Access is limited to authorized Labelbox users.
        </p>
        <a
          className={buttonVariants({ className: "mt-6 w-full" })}
          href={`/api/auth/authorize?next=${encodeURIComponent(nextPath)}`}
        >
          Sign in with Vercel
        </a>
      </section>
    </main>
  );
}
