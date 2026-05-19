import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getAuthUser, sanitizeRedirectPath } from "@/lib/auth";

type SignInPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  "email-required": "Enter your authorized Labelbox email to continue.",
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const user = await getAuthUser();
  const { error, next } = await searchParams;
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
        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {ERROR_MESSAGES[error] ?? "Unable to start sign-in."}
          </p>
        ) : null}
        <form action="/api/auth/authorize" className="mt-6 space-y-4 text-left">
          <input type="hidden" name="next" value={nextPath} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Labelbox email
            </label>
            <input
              autoComplete="email"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              id="email"
              name="email"
              placeholder="you@labelbox.com"
              required
              type="email"
            />
          </div>
          <button className={buttonVariants({ className: "w-full" })} type="submit">
            Continue with Vercel
          </button>
        </form>
      </section>
    </main>
  );
}
