import { Hourglass } from "lucide-react";

/** Shared "not available yet" placeholder for tools that are still in the works. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div
      className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex size-16 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10">
        <Hourglass className="size-8 text-primary" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-bold tracking-wide uppercase">{title}</h2>
      <p className="max-w-sm text-sm font-semibold text-primary">Coming soon</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Not available now. This tool is still in the works and will arrive in a future update of
        SYNCLAB.
      </p>
    </div>
  );
}
