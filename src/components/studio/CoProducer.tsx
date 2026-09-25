import { useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStudio } from "@/lib/synclab/store";
import { askCoProducer } from "@/lib/coproducer.functions";
import { KIND_LABEL } from "@/lib/synclab/presets";
import { toast } from "sonner";
import { CreativeToolThemePicker, useCreativeToolTheme } from "./CreativeToolTheme";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "Give me a Detroit techno arrangement for 8 bars.",
  "What kit and pattern should I use for this BPM?",
  "How do I make my kick and bass sit together?",
  "Suggest a chord progression and a bassline in my key.",
];

export function CoProducer() {
  const { tracks, transport } = useStudio();
  const ask = useServerFn(askCoProducer);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useCreativeToolTheme("coproducer");

  const session = useMemo(() => {
    const lines = [
      `Tempo: ${transport.bpm} BPM, swing ${Math.round((transport.swing ?? 0) * 100)}%`,
      `Length: ${transport.bars ?? 4} bars`,
      tracks.length === 0
        ? "Tracks: none yet — the session is empty."
        : `Tracks (${tracks.length}): ${tracks
            .map((t) => `${t.name} [${KIND_LABEL[t.kind] ?? t.kind}${t.patch ? ` · ${t.patch.name}` : ""}]`)
            .join(", ")}`,
    ];
    return lines.join("\n");
  }, [tracks, transport]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await ask({ data: { messages: next, session } });
      setMessages([...next, { role: "assistant", content: res.text }]);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }));
    } catch (error) {
      toast.error("Co-Producer unavailable", { description: (error as Error)?.message });
      setMessages(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="creative-tool flex h-full min-h-0 flex-col gap-3 p-3" data-creative-theme={theme}>
      <div className="flex items-center gap-2">
        <span className="label-xs">AI CO-PRODUCER — knows your tempo, tracks and instruments</span>
        <div className="ml-auto"><CreativeToolThemePicker tool="coproducer" theme={theme} onChange={setTheme} /></div>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setMessages([])}>
            <Trash2 className="size-4" /> Clear
          </Button>
        )}
      </div>

      <div ref={listRef} className="panel min-h-32 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="size-4 text-primary" /> Ask about arrangement, sound design, mixing or what to do next.
            </p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="rounded-full border border-border bg-surface-2/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary/15 text-foreground"
                    : "border border-border bg-surface-2/60 text-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Thinking about your session…
          </p>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask your Co-Producer… (Enter to send, Shift+Enter for a new line)"
          className="min-h-16"
        />
        <Button className="glow" disabled={busy || !input.trim()} onClick={() => void send(input)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} ASK
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Sparkles className="size-3" /> The Co-Producer gives advice and settings — it does not change your session on
        its own.
      </p>
    </div>
  );
}
