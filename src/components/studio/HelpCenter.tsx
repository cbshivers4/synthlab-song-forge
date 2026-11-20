import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Bug, Check, Info, LifeBuoy, Search, Settings2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMaybeApp } from "@/lib/synclab/app-state";
import { SUPPORT_EMAIL } from "@/lib/synclab/contact";
import { isFounderEmail } from "@/lib/synclab/plan-tier";
import {
  EMPTY_SETTINGS,
  HELP_CATEGORIES,
  KNOWLEDGE_BASE,
  SYNCLAB_NAME,
  SYNCLAB_TAGLINE,
  SYNCLAB_VERSION,
  collectDiagnostics,
  isSupportAdmin,
  loadSupportSettings,
  saveSupportSettings,
  searchArticles,
  submitTicket,
  type Article,
  type HelpCategory,
  type SupportSettings,
} from "@/lib/synclab/support";

export const HELP_EVENT = "synclab:help";
export type HelpTab = "help" | "support" | "problem" | "about" | "admin";
export const openHelp = (tab: HelpTab = "help") =>
  window.dispatchEvent(new CustomEvent(HELP_EVENT, { detail: tab }));
/** Opens Help with one article expanded (used by the library search). */
export const openHelpArticle = (articleId: string) =>
  window.dispatchEvent(
    new CustomEvent(HELP_EVENT, { detail: { tab: "help", article: articleId } }),
  );

const SUPPORT_CATEGORIES = [
  "Account",
  "Billing",
  "Projects",
  "Audio",
  "MIDI",
  "Recording",
  "Synthesizers",
  "Drum Machine",
  "Sampler",
  "Beat Maker",
  "AI",
  "Vocals",
  "Vocoder",
  "Plugins",
  "Mixing",
  "Mastering",
  "Export",
  "Desktop",
  "Mobile",
  "Bug",
  "Feature request",
];

const PROBLEM_CATEGORIES = [
  "Crash",
  "Audio",
  "MIDI",
  "Plugin",
  "Timeline",
  "Piano Roll",
  "Recording",
  "AI",
  "Export",
  "UI",
  "Other",
];

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function HelpCenter() {
  const app = useMaybeApp();
  const projectName = app?.project?.name ?? "";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<HelpTab>("help");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [settings, setSettings] = useState<SupportSettings>(EMPTY_SETTINGS);

  const [query, setQuery] = useState("");
  const [openArticle, setOpenArticle] = useState<string | null>(null);
  const [helpCat, setHelpCat] = useState<HelpCategory | "All">("All");

  const [category, setCategory] = useState(SUPPORT_CATEGORIES[0]!);
  const [pCategory, setPCategory] = useState(PROBLEM_CATEGORIES[0]!);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [steps, setSteps] = useState("");
  const [includeDiag, setIncludeDiag] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<HelpTab | { tab: HelpTab; article: string }>).detail;
      if (detail && typeof detail === "object") {
        setTab(detail.tab);
        setQuery("");
        setHelpCat("All");
        setOpenArticle(detail.article);
      } else setTab(detail ?? "help");
      setOpen(true);
    };
    window.addEventListener(HELP_EVENT, onOpen);
    return () => window.removeEventListener(HELP_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    void supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setUserId(u?.id ?? null);
      // The founder signs in with Gmail but handles support from the SYNCLAB address.
      const account = (u?.email ?? "").toLowerCase();
      const replyEmail = isFounderEmail(account) ? SUPPORT_EMAIL : (u?.email ?? "");
      setEmail((prev) => (prev && !isFounderEmail(prev) ? prev : replyEmail));
      void isSupportAdmin(u?.id).then(setAdmin);
    });
    void loadSupportSettings().then(setSettings);
  }, [open]);

  const diagnostics = useMemo(
    () => (open ? collectDiagnostics(projectName ? { project: projectName } : {}) : {}),
    [open, projectName],
  );

  const articles = useMemo(
    () => searchArticles(query).filter((a) => helpCat === "All" || a.category === helpCat),
    [query, helpCat],
  );
  const grouped = useMemo(
    () =>
      HELP_CATEGORIES.map((c) => ({ c, list: articles.filter((a) => a.category === c) })).filter(
        (g) => g.list.length,
      ),
    [articles],
  );

  const send = useCallback(
    async (kind: "support" | "problem") => {
      if (!userId) {
        toast("Sign in first", { description: "Support tickets are attached to your account." });
        return;
      }
      if (!subject.trim() || !description.trim()) {
        toast("Subject and description are required");
        return;
      }
      setBusy(true);
      const err = await submitTicket(userId, {
        kind,
        name,
        email,
        category: kind === "support" ? category : pCategory,
        subject,
        description,
        expected,
        steps,
        project_name: projectName,
        diagnostics: includeDiag ? diagnostics : {},
      });
      setBusy(false);
      if (err) {
        toast("SYNCLAB couldn't send this ticket", { description: err });
        return;
      }
      setSubject("");
      setDescription("");
      setExpected("");
      setSteps("");
      toast("Sent to SYNCLAB Support", {
        description: settings.support_email
          ? `We'll reply to ${email || "your account email"}. You can also write to ${settings.support_email}.`
          : `We'll reply to ${email || "your account email"}.`,
      });
    },
    [
      userId,
      subject,
      description,
      name,
      email,
      category,
      pCategory,
      expected,
      steps,
      projectName,
      includeDiag,
      diagnostics,
      settings.support_email,
    ],
  );

  const tabs: { id: HelpTab; label: string; icon: React.ReactNode }[] = [
    { id: "help", label: "Help Center", icon: <BookOpen className="size-3.5" /> },
    { id: "support", label: "Contact Support", icon: <LifeBuoy className="size-3.5" /> },
    { id: "problem", label: "Report a Problem", icon: <Bug className="size-3.5" /> },
    { id: "about", label: "About", icon: <Info className="size-3.5" /> },
    ...(admin
      ? [
          {
            id: "admin" as HelpTab,
            label: "Support Settings",
            icon: <Settings2 className="size-3.5" />,
          },
        ]
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="tracking-wide">SYNCLAB HELP CENTER</DialogTitle>
          <DialogDescription>
            Answers, support and problem reports for {SYNCLAB_NAME}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                tab === t.id
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[58vh] overflow-y-auto pr-1">
          {tab === "help" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHelpCat("All");
                  }}
                  placeholder="Search help — recording, DJ, flam, MIDI, export, phone…"
                  className="pl-8"
                  aria-label="Search the knowledge base"
                />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Help categories">
                {(["All", ...HELP_CATEGORIES] as const).map((c) => (
                  <Chip
                    key={c}
                    active={helpCat === c}
                    onClick={() => {
                      setHelpCat(helpCat === c ? "All" : c);
                      setOpenArticle(null);
                    }}
                  >
                    {c === "All" ? `All (${KNOWLEDGE_BASE.length})` : c}
                  </Chip>
                ))}
              </div>
              {articles.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing matched that. Try another word or category, or contact SYNCLAB Support.
                </p>
              )}
              {grouped.map(({ c, list }) => (
                <section key={c} className="space-y-1.5" aria-label={c}>
                  <h3 className="pt-1 text-[11px] font-bold tracking-[0.2em] text-primary uppercase">
                    {c} <span className="text-muted-foreground">· {list.length}</span>
                  </h3>
                  {list.map((a) => (
                    <HelpArticle
                      key={a.id}
                      a={a}
                      open={openArticle === a.id}
                      onToggle={() => setOpenArticle(openArticle === a.id ? null : a.id)}
                    />
                  ))}
                </section>
              ))}
              {settings.knowledge_base_url && (
                <a
                  className="inline-block text-xs underline"
                  href={settings.knowledge_base_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open the full SYNCLAB knowledge base
                </a>
              )}
            </div>
          )}

          {(tab === "support" || tab === "problem") && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(tab === "support" ? SUPPORT_CATEGORIES : PROBLEM_CATEGORIES).map((c) => (
                  <Chip
                    key={c}
                    active={(tab === "support" ? category : pCategory) === c}
                    onClick={() => (tab === "support" ? setCategory(c) : setPCategory(c))}
                  >
                    {c}
                  </Chip>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email for the reply</Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">
                  {tab === "support" ? "Subject" : "What happened?"}
                </Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">
                  {tab === "support" ? "Description" : "Describe the problem"}
                </Label>
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              {tab === "problem" && (
                <>
                  <div>
                    <Label className="text-xs">What did you expect to happen?</Label>
                    <Textarea
                      rows={2}
                      value={expected}
                      onChange={(e) => setExpected(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">How can we reproduce it?</Label>
                    <Textarea rows={3} value={steps} onChange={(e) => setSteps(e.target.value)} />
                  </div>
                </>
              )}

              <div className="rounded-md border border-border p-3">
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={includeDiag}
                    onChange={(e) => setIncludeDiag(e.target.checked)}
                  />
                  Include diagnostics (you can read them first)
                </label>
                {includeDiag && (
                  <pre className="mt-2 max-h-36 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {JSON.stringify(diagnostics, null, 2)}
                  </pre>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  {settings.support_email
                    ? `Prefer email? ${settings.support_email}`
                    : "No support email is configured yet — tickets go straight to the SYNCLAB inbox."}
                </p>
                <Button
                  disabled={busy}
                  onClick={() => void send(tab === "support" ? "support" : "problem")}
                >
                  {busy ? "SENDING…" : "SEND TO SYNCLAB"}
                </Button>
              </div>
            </div>
          )}

          {tab === "about" && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <h3 className="text-lg font-bold tracking-wide text-foreground">{SYNCLAB_NAME}</h3>
                <p className="text-xs tracking-[0.25em] uppercase">{SYNCLAB_TAGLINE}</p>
              </div>
              <p>Version {SYNCLAB_VERSION} · Web edition</p>
              <p>© {new Date().getFullYear()} SYNCLAB. All rights reserved.</p>
              <p>
                Built-in instruments, effects, separation and mastering run on your device using Web
                Audio. SYNCLAB Desktop adds real Save/Open on your own drive; it can list your
                VST3/AU/CLAP plugins but can't run them yet.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <a className="underline" href={settings.terms_url || "/terms"}>
                  Terms
                </a>
                <a className="underline" href={settings.privacy_url || "/privacy"}>
                  Privacy
                </a>
                <a className="underline" href="/refunds">
                  Refunds
                </a>
                <a className="underline" href="/pricing">
                  Pricing
                </a>
                {settings.support_website && (
                  <a
                    className="underline"
                    href={settings.support_website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website
                  </a>
                )}
                {settings.status_url && (
                  <a
                    className="underline"
                    href={settings.status_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Status
                  </a>
                )}
                {settings.community_url && (
                  <a
                    className="underline"
                    href={settings.community_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Community
                  </a>
                )}
                {settings.tutorials_url && (
                  <a
                    className="underline"
                    href={settings.tutorials_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Tutorials
                  </a>
                )}
              </div>
              <p className="text-[11px]">
                Third-party licenses: Web Audio API, React, TanStack Router, Tailwind CSS, lucide
                icons, LAME MP3 encoder (LGPL).
              </p>
            </div>
          )}

          {tab === "admin" && <AdminSettings settings={settings} onSaved={setSettings} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HelpArticle({ a, open, onToggle }: { a: Article; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-semibold"
      >
        {a.title}
        <span className="text-xs text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3 text-sm">
          <div className="space-y-1.5 text-muted-foreground">
            <h4 className="text-[11px] font-bold tracking-[0.15em] text-foreground uppercase">
              How to use it
            </h4>
            {a.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-primary/5 p-2.5">
              <h4 className="mb-1.5 text-[11px] font-bold tracking-[0.15em] text-primary uppercase">
                What you can do
              </h4>
              <ul className="space-y-1">
                {a.can.map((p, i) => (
                  <li key={i} className="flex gap-1.5 text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-border bg-destructive/5 p-2.5">
              <h4 className="mb-1.5 text-[11px] font-bold tracking-[0.15em] text-destructive uppercase">
                What you can't do
              </h4>
              <ul className="space-y-1">
                {a.cant.map((p, i) => (
                  <li key={i} className="flex gap-1.5 text-muted-foreground">
                    <X className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminSettings({
  settings,
  onSaved,
}: {
  settings: SupportSettings;
  onSaved: (s: SupportSettings) => void;
}) {
  const [draft, setDraft] = useState<SupportSettings>(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(settings), [settings]);

  const fields: { key: keyof SupportSettings; label: string; placeholder: string }[] = [
    { key: "support_email", label: "Support email", placeholder: "support@yourdomain.com" },
    { key: "support_website", label: "Support website", placeholder: "https://…" },
    { key: "help_center_url", label: "Help Center URL", placeholder: "https://…" },
    { key: "knowledge_base_url", label: "Knowledge Base URL", placeholder: "https://…" },
    { key: "terms_url", label: "Terms URL", placeholder: "/terms" },
    { key: "privacy_url", label: "Privacy URL", placeholder: "/privacy" },
    { key: "status_url", label: "Status page URL", placeholder: "https://…" },
    { key: "community_url", label: "Community URL", placeholder: "https://…" },
    { key: "tutorials_url", label: "Tutorial video URL", placeholder: "https://…" },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Admin only. These destinations are used across the app — nothing is hard-coded.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}>
            <Label className="text-xs">{f.label}</Label>
            <Input
              value={draft[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const err = await saveSupportSettings(draft);
          setBusy(false);
          if (err) {
            toast("SYNCLAB couldn't save these settings", { description: err });
            return;
          }
          onSaved(draft);
          toast("Support settings saved");
        }}
      >
        {busy ? "SAVING…" : "SAVE SUPPORT SETTINGS"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {KNOWLEDGE_BASE.length} built-in help articles ship with the app and stay available offline.
      </p>
    </div>
  );
}
