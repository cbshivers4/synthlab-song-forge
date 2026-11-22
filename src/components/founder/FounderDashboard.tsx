import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Copy,
  Download,
  Inbox,
  LogIn,
  Mail,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { syncAllToLoops, type FounderAccount } from "@/utils/founder.functions";
import {
  formatPlace,
  inCampaignAudience,
  campaignDay,
  type AccountPlan,
} from "@/lib/founder/insights";
import {
  CAMPAIGN_EMAILS,
  CAMPAIGN_EVENT,
  PAID_EVENT,
  campaignEmailText,
  emailForDay,
} from "@/lib/founder/email-campaign";
import { countryName } from "@/lib/founder/links";
import {
  founderOverviewQuery,
  loginHistoryQuery,
  supportMessagesQuery,
  type FounderTab,
} from "./founder-queries";

const DAY = 86_400_000;

const TAB_LIST: { id: FounderTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <BarChart3 className="size-4" /> },
  { id: "logins", label: "Sign-ins", icon: <LogIn className="size-4" /> },
  { id: "accounts", label: "Accounts", icon: <Users className="size-4" /> },
  { id: "messages", label: "Messages", icon: <Inbox className="size-4" /> },
  { id: "campaign", label: "Email campaign", icon: <Mail className="size-4" /> },
];

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

const place = (p: { city: string; region: string; country: string; timezone: string } | null) =>
  p ? formatPlace(p, countryName) : "Not recorded yet";

function PlanBadge({ plan }: { plan: string }) {
  const label: Record<string, string> = {
    founder: "Founder",
    pro: "Paid",
    trial: "Trial",
    past_due: "Payment due",
    free: "Unpaid",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
        plan === "pro" || plan === "founder"
          ? "border-primary/60 text-primary"
          : plan === "trial"
            ? "border-accent/60 text-accent"
            : plan === "past_due"
              ? "border-destructive/60 text-destructive"
              : "border-border text-muted-foreground",
      )}
    >
      {label[plan] ?? plan}
    </span>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string | undefined;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-3xl font-extrabold text-foreground">{value}</div>
      {note && <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function FounderDashboard({
  tab,
  onTab,
}: {
  tab: FounderTab;
  onTab: (t: FounderTab) => void;
}) {
  const { data: overview } = useSuspenseQuery(founderOverviewQuery);
  const logins = useQuery(loginHistoryQuery);
  const messages = useQuery(supportMessagesQuery);
  const openMessages = (messages.data ?? []).filter((m) => m.status === "open").length;

  return (
    <div className="h-[100dvh] overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto">
            <h1 className="font-display text-lg font-extrabold tracking-tight">
              SYNCLAB <span className="text-primary">Founder Analytics</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Private — only your founder account can see this page.
            </p>
          </div>
          <nav className="flex flex-wrap gap-1" aria-label="Dashboard sections">
            {TAB_LIST.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={tab === t.id ? "default" : "ghost"}
                onClick={() => onTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
              >
                {t.icon}
                {t.label}
                {t.id === "messages" && openMessages > 0 && (
                  <span className="ml-1 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {openMessages}
                  </span>
                )}
              </Button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === "overview" && (
          <Overview
            accounts={overview.accounts}
            logins={logins.data ?? []}
            openMessages={openMessages}
            onTab={onTab}
          />
        )}
        {tab === "logins" && <SignIns logins={logins.data ?? []} loading={logins.isLoading} />}
        {tab === "accounts" && <Accounts accounts={overview.accounts} />}
        {tab === "messages" && <Messages rows={messages.data ?? []} loading={messages.isLoading} />}
        {tab === "campaign" && (
          <Campaign accounts={overview.accounts} loopsConnected={overview.loopsConnected} />
        )}
      </main>
    </div>
  );
}

type LoginRow = Database["public"]["Tables"]["login_events"]["Row"];

function Overview({
  accounts,
  logins,
  openMessages,
  onTab,
}: {
  accounts: FounderAccount[];
  logins: LoginRow[];
  openMessages: number;
  onTab: (t: FounderTab) => void;
}) {
  const now = Date.now();
  const count = (p: AccountPlan) => accounts.filter((a) => a.plan === p).length;
  const newWeek = accounts.filter((a) => now - new Date(a.createdAt).getTime() < 7 * DAY).length;
  const today = new Date().toDateString();
  const signInsToday = logins.filter((l) => new Date(l.created_at).toDateString() === today).length;
  const signInsWeek = logins.filter((l) => now - new Date(l.created_at).getTime() < 7 * DAY).length;
  const activeWeek = new Set(
    logins.filter((l) => now - new Date(l.created_at).getTime() < 7 * DAY).map((l) => l.user_id),
  ).size;

  const days = useMemo(() => {
    const out: { label: string; signIns: number; joined: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      const key = d.toDateString();
      out.push({
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        signIns: logins.filter((l) => new Date(l.created_at).toDateString() === key).length,
        joined: accounts.filter((a) => new Date(a.createdAt).toDateString() === key).length,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logins, accounts]);
  const max = Math.max(1, ...days.map((d) => Math.max(d.signIns, d.joined)));

  const places = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logins) {
      const k = formatPlace(l, countryName);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [logins]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Accounts" value={accounts.length} note={`${newWeek} new this week`} />
        <Stat label="Paying" value={count("pro")} note={`${count("trial")} on free trial`} />
        <Stat
          label="Unpaid"
          value={count("free") + count("past_due")}
          note={`${count("past_due")} with a payment due`}
        />
        <Stat label="Messages to read" value={openMessages} note="Support and problem reports" />
        <Stat label="Sign-ins today" value={signInsToday} />
        <Stat
          label="Sign-ins this week"
          value={signInsWeek}
          note={`${activeWeek} different people`}
        />
        <Stat label="Said yes to emails" value={accounts.filter((a) => a.optedIn).length} />
        <Stat
          label="In the 30-day campaign"
          value={
            accounts.filter((a) => a.campaignStartedAt && a.plan !== "pro" && a.plan !== "trial")
              .length
          }
        />
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold">Last 30 days</h2>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-primary" />
              Sign-ins
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-accent" />
              New accounts
            </span>
          </div>
        </div>
        <div
          className="flex h-40 items-end gap-1"
          role="img"
          aria-label="Sign-ins and new accounts per day for the last 30 days"
        >
          {days.map((d) => (
            <div
              key={d.label}
              className="group relative flex h-full flex-1 items-end gap-px"
              title={`${d.label}: ${d.signIns} sign-ins, ${d.joined} new accounts`}
            >
              <div
                className="w-1/2 rounded-t-sm bg-primary"
                style={{ height: `${(d.signIns / max) * 100}%` }}
              />
              <div
                className="w-1/2 rounded-t-sm bg-accent"
                style={{ height: `${(d.joined / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>{days[0]?.label}</span>
          <span>Today</span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-bold">
            <MapPin className="size-4 text-primary" />
            Where people sign in from
          </h2>
          {places.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sign-ins recorded yet. They appear from the next sign-in on.
            </p>
          ) : (
            <ul className="space-y-1">
              {places.map(([p, n]) => (
                <li key={p} className="flex justify-between gap-2 text-sm">
                  <span className="truncate">{p}</span>
                  <span className="font-mono text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold">
              <LogIn className="size-4 text-primary" />
              Latest sign-ins
            </h2>
            <Button size="sm" variant="ghost" onClick={() => onTab("logins")}>
              See all
            </Button>
          </div>
          {logins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody has signed in since the history started.
            </p>
          ) : (
            <ul className="space-y-2">
              {logins.slice(0, 6).map((l) => (
                <li key={l.id} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate font-semibold">{l.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {ago(l.created_at)}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {l.email} · {formatPlace(l, countryName)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="text-xs text-muted-foreground">
        Website visits from people who aren't signed in (page views, where visitors come from) are
        in your project's Analytics view in the editor.
      </p>
    </div>
  );
}

function SignIns({ logins, loading }: { logins: LoginRow[]; loading: boolean }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "sign_in" | "open">("all");
  const rows = logins.filter((l) => {
    if (kind !== "all" && l.kind !== kind) return false;
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [l.name, l.email, l.city, l.region, l.country, l.device].some((v) =>
      v.toLowerCase().includes(t),
    );
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search name, email or place"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search sign-ins"
        />
        {(["all", "sign_in", "open"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={kind === k ? "secondary" : "ghost"}
            onClick={() => setKind(k)}
          >
            {k === "all" ? "All" : k === "sign_in" ? "Sign-ins" : "App openings"}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() =>
            downloadCsv("synclab-sign-ins.csv", [
              [
                "When",
                "Type",
                "Name",
                "Email",
                "City",
                "Region",
                "Country",
                "Device",
                "Browser",
                "Plan",
              ],
              ...rows.map((l) => [
                l.created_at,
                l.kind,
                l.name,
                l.email,
                l.city,
                l.region,
                l.country,
                l.device,
                l.browser,
                l.plan,
              ]),
            ])
          }
        >
          <Download className="size-4" />
          Download
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A sign-in is a new login. An app opening is the same login coming back after 6 hours or
        more. Location is worked out from the internet connection, so it's usually the nearest city,
        not an exact address.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">When</th>
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Location</th>
              <th className="p-2">Device</th>
              <th className="p-2">Plan</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>
                  No sign-ins match.
                </td>
              </tr>
            )}
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="whitespace-nowrap p-2">
                  {when(l.created_at)}
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {l.kind === "sign_in" ? "Sign-in" : "App opening"}
                  </div>
                </td>
                <td className="p-2 font-semibold">{l.name}</td>
                <td className="break-all p-2">{l.email}</td>
                <td className="p-2">{formatPlace(l, countryName)}</td>
                <td className="whitespace-nowrap p-2">
                  {l.device}
                  <div className="text-[10px] text-muted-foreground">{l.browser}</div>
                </td>
                <td className="p-2">
                  <PlanBadge plan={l.plan} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Accounts({ accounts }: { accounts: FounderAccount[] }) {
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState<"all" | "paid" | "unpaid">("all");
  const rows = accounts.filter((a) => {
    if (plan === "paid" && !["pro", "trial", "founder"].includes(a.plan)) return false;
    if (plan === "unpaid" && !["free", "past_due"].includes(a.plan)) return false;
    const t = q.trim().toLowerCase();
    return !t || a.name.toLowerCase().includes(t) || a.email.includes(t);
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search accounts"
        />
        {(["all", "paid", "unpaid"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={plan === k ? "secondary" : "ghost"}
            onClick={() => setPlan(k)}
          >
            {k === "all" ? "All" : k === "paid" ? "Paid & trial" : "Unpaid"}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() =>
            downloadCsv("synclab-accounts.csv", [
              ["Name", "Email", "Plan", "Joined", "Last sign-in", "Location", "Said yes to emails"],
              ...rows.map((a) => [
                a.name,
                a.email,
                a.plan,
                a.createdAt,
                a.lastSignInAt ?? "",
                place(a.lastPlace),
                a.optedIn ? "yes" : "no",
              ]),
            ])
          }
        >
          <Download className="size-4" />
          Download
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Plan</th>
              <th className="p-2">Joined</th>
              <th className="p-2">Last sign-in</th>
              <th className="p-2">Location</th>
              <th className="p-2">Emails</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={7}>
                  No accounts match.
                </td>
              </tr>
            )}
            {rows.map((a) => {
              const day = campaignDay(a.campaignStartedAt);
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-2 font-semibold">
                    {a.name}
                    <div className="text-[10px] uppercase text-muted-foreground">{a.provider}</div>
                  </td>
                  <td className="break-all p-2">{a.email}</td>
                  <td className="p-2">
                    <PlanBadge plan={a.plan} />
                  </td>
                  <td className="whitespace-nowrap p-2">{when(a.createdAt)}</td>
                  <td className="whitespace-nowrap p-2">
                    {ago(a.lastSignInAt)}
                    <div className="text-[10px] text-muted-foreground">
                      {a.signIns30d} in 30 days
                    </div>
                  </td>
                  <td className="p-2">{place(a.lastPlace)}</td>
                  <td className="p-2 text-xs">
                    {a.optedIn ? (
                      day !== null ? (
                        `Campaign day ${day}`
                      ) : (
                        "Said yes"
                      )
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                    {a.loopsError && <div className="text-destructive">Email service problem</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type MessageRow = Database["public"]["Tables"]["support_tickets"]["Row"];

function Messages({ rows, loading }: { rows: MessageRow[]; loading: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (error) toast.error("Couldn't update the message", { description: error.message });
    await qc.invalidateQueries({ queryKey: supportMessagesQuery.queryKey });
  };
  const shown = rows.filter((r) => filter === "all" || r.status === "open");
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filter === "open" ? "secondary" : "ghost"}
          onClick={() => setFilter("open")}
        >
          To read
        </Button>
        <Button
          size="sm"
          variant={filter === "all" ? "secondary" : "ghost"}
          onClick={() => setFilter("all")}
        >
          All messages
        </Button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && shown.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {filter === "open"
            ? "No new messages. Messages from Contact Support and Report a Problem land here."
            : "No messages yet."}
        </p>
      )}
      <ul className="space-y-2">
        {shown.map((m) => {
          const expanded = open === m.id;
          return (
            <li
              key={m.id}
              className={cn(
                "rounded-lg border bg-card",
                m.status === "open" ? "border-primary/50" : "border-border",
              )}
            >
              <button
                type="button"
                className="flex w-full items-start gap-3 p-3 text-left"
                aria-expanded={expanded}
                onClick={() => {
                  setOpen(expanded ? null : m.id);
                  if (!expanded && m.status === "open") void setStatus(m.id, "read");
                }}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    m.status === "open" ? "bg-primary" : "bg-muted",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{m.subject || "(no subject)"}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {when(m.created_at)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.kind === "problem" ? "Problem report" : "Support"} · {m.category} · {m.name}{" "}
                    &lt;{m.email}&gt;
                  </span>
                </span>
              </button>
              {expanded && (
                <div className="space-y-3 border-t border-border p-3 text-sm">
                  <p className="whitespace-pre-wrap">{m.description}</p>
                  {m.expected && (
                    <p>
                      <span className="font-semibold">Expected: </span>
                      <span className="whitespace-pre-wrap">{m.expected}</span>
                    </p>
                  )}
                  {m.steps && (
                    <p>
                      <span className="font-semibold">Steps: </span>
                      <span className="whitespace-pre-wrap">{m.steps}</span>
                    </p>
                  )}
                  {m.project_name && (
                    <p className="text-xs text-muted-foreground">Project: {m.project_name}</p>
                  )}
                  {m.diagnostics && Object.keys(m.diagnostics as object).length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Device details</summary>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(m.diagnostics, null, 2)}
                      </pre>
                    </details>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" asChild>
                      <a
                        href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}
                      >
                        <Mail className="size-4" />
                        Reply by email
                      </a>
                    </Button>
                    {m.status !== "closed" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void setStatus(m.id, "closed")}
                      >
                        Mark done
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void setStatus(m.id, "open")}
                      >
                        Mark as new
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Campaign({
  accounts,
  loopsConnected,
}: {
  accounts: FounderAccount[];
  loopsConnected: boolean;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const unpaid = accounts.filter((a) => a.plan === "free" || a.plan === "past_due");
  const audience = accounts.filter((a) =>
    inCampaignAudience({ email: a.email, plan: a.plan as AccountPlan, optedIn: a.optedIn }),
  );
  const started = audience.filter((a) => a.campaignStartedAt);
  const failed = accounts.filter((a) => a.loopsError);

  const sync = async () => {
    setBusy(true);
    try {
      const r = await syncAllToLoops();
      if (!r.connected) toast.error("Loops isn't connected yet.");
      else
        toast.success(`Sent ${r.synced} contacts to Loops`, {
          description: `${r.started} started the campaign${r.failed ? ` · ${r.failed} had a problem` : ""}`,
        });
      await qc.invalidateQueries({ queryKey: founderOverviewQuery.queryKey });
    } catch (e) {
      toast.error("Sync failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Unpaid accounts" value={unpaid.length} />
        <Stat label="Unpaid & said yes" value={audience.length} note="Who the campaign is for" />
        <Stat label="Campaign started" value={started.length} />
        <Stat
          label="Email service"
          value={loopsConnected ? "Loops ✓" : "Not connected"}
          note={failed.length ? `${failed.length} contacts had a problem` : undefined}
        />
      </div>

      <section className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
        <h2 className="font-display text-sm font-bold">How it works</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Only people who ticked "Email me tips and offers" are sent to Loops. Founder and paying
            accounts never get the campaign.
          </li>
          <li>
            When an unpaid person says yes, the app tells Loops to start the 30-day campaign (event{" "}
            <code className="text-foreground">{CAMPAIGN_EVENT}</code>).
          </li>
          <li>
            When someone starts a trial or pays, the app updates them in Loops (
            <code className="text-foreground">isPaid</code> = true, event{" "}
            <code className="text-foreground">{PAID_EVENT}</code>) so the remaining emails stop.
          </li>
          <li>Loops adds the unsubscribe link to every email.</li>
        </ul>
        <h3 className="pt-2 font-semibold">One-time setup in Loops</h3>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Verify your sending domain in Loops (Settings → Domain).</li>
          <li>
            Create a Loop that starts on the event{" "}
            <code className="text-foreground">{CAMPAIGN_EVENT}</code>.
          </li>
          <li>
            Add the {CAMPAIGN_EMAILS.length} emails below in order, with a timer before each one
            matching its day.
          </li>
          <li>
            On every email, add the audience filter{" "}
            <code className="text-foreground">isPaid is false</code>, then start the Loop.
          </li>
        </ol>
        <div className="pt-2">
          <Button size="sm" onClick={() => void sync()} disabled={busy || !loopsConnected}>
            <RefreshCw className={cn("size-4", busy && "animate-spin")} />
            {busy ? "Sending to Loops…" : "Send everyone who said yes to Loops"}
          </Button>
          {!loopsConnected && (
            <p className="mt-1 text-xs text-muted-foreground">Connect Loops first.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold">The {CAMPAIGN_EMAILS.length} emails</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv("synclab-campaign-audience.csv", [
                ["Name", "Email", "Joined", "Campaign day", "Email due"],
                ...audience.map((a) => {
                  const d = campaignDay(a.campaignStartedAt);
                  return [
                    a.name,
                    a.email,
                    a.createdAt,
                    d ?? "not started",
                    emailForDay(d)?.subject ?? "",
                  ];
                }),
              ])
            }
          >
            <Download className="size-4" />
            Audience list
          </Button>
        </div>
        {CAMPAIGN_EMAILS.map((e) => (
          <article key={e.day} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
                  Day {e.day}
                </div>
                <h3 className="font-semibold">{e.subject}</h3>
                <p className="text-xs text-muted-foreground">Preview: {e.preview}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `Subject: ${e.subject}\nPreview: ${e.preview}\n\n${campaignEmailText(e)}`,
                  );
                  toast.success(`Day ${e.day} email copied`);
                }}
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Read the email
              </summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-foreground">
                {campaignEmailText(e)}
              </pre>
            </details>
          </article>
        ))}
      </section>
    </div>
  );
}
