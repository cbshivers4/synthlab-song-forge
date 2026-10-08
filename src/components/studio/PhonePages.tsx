import { type ReactNode } from "react";

/** Shared phone scroll region; editors retain their native inner scroll areas. */
export function PhonePages({ children, name }: { children: ReactNode; name: string }) {
  return <div className="phone-pages flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="phone-page-viewport relative min-h-0 flex-1 overflow-auto" aria-label={`${name} pages`}>{children}</div>
  </div>;
}
