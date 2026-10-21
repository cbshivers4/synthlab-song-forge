import { useEffect, useState } from "react";

/** Digital clock showing the device's own local date and time (renders after mount to avoid hydration mismatch). */
export function DeviceClock({ mobile, inline }: { mobile?: boolean; inline?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return inline ? null : <div className={mobile ? "w-[126px]" : "w-[184px]"} aria-hidden />;
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: mobile ? undefined : "2-digit" });
  const date = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: mobile ? undefined : "numeric" });
  if (inline) return <span className="shrink-0 font-mono text-[17px] font-semibold tabular-nums text-primary" aria-label={`Device clock ${date} ${time}`}>{date} · {time}</span>;
  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center rounded-[3px] border border-border bg-background/80 px-3 py-1 font-mono leading-tight"
      title={now.toLocaleString()}
      aria-label={`Device clock ${date} ${time}`}
    >
      <span className={`${mobile ? "text-lg" : "text-xl"} font-bold tabular-nums text-primary`}>{time}</span>
      <span className="text-xs text-muted-foreground">{date}</span>
    </div>
  );
}
