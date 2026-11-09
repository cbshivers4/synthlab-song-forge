import { useRef, type ReactNode } from "react";
import { TimelineVScrollbar } from "./timeline/VScrollbar";

/**
 * Shared phone scroll region; editors retain their native inner scroll areas.
 * `scrollbar` adds the teal side bar so busy control pages (Live Drummer, Live Keys, DJ Decks)
 * can be scrolled without dragging across their knobs and faders.
 */
export function PhonePages({ children, name, scrollbar = false }: { children: ReactNode; name: string; scrollbar?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  return <div className="phone-pages relative flex min-h-0 flex-1 flex-col overflow-hidden" data-side-scroll={scrollbar || undefined}>
    <div ref={viewport} id={scrollbar ? "phone-page-scroll" : undefined} className="phone-page-viewport relative min-h-0 flex-1 overflow-auto" aria-label={`${name} pages`}>{children}</div>
    {scrollbar && <TimelineVScrollbar scrollRef={viewport} controls="phone-page-scroll" label={`Scroll ${name} up and down`} />}
  </div>;
}
