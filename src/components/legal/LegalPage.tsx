import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const LEGAL_LINKS = [
  { to: "/pricing", label: "Pricing" },
  { to: "/terms", label: "Terms" },
  { to: "/refunds", label: "Refunds" },
  { to: "/privacy", label: "Privacy" },
] as const;

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground ${className}`}
    >
      {LEGAL_LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="hover:text-foreground hover:underline">
          {l.label}
        </Link>
      ))}
      <span className="opacity-60">© {new Date().getFullYear()} SYNCLAB</span>
    </div>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-sm font-bold tracking-[0.2em]">
            SYNCLAB
          </Link>
          <nav className="flex gap-4 text-xs text-muted-foreground">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-foreground hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          Last updated {updated}
        </p>
        <div className="legal-body mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
          {children}
        </div>
      </main>
      <footer className="border-t border-border/60 py-8">
        <LegalFooter />
      </footer>
    </div>
  );
}
