import {
  AudioLines,
  Bot,
  Disc3,
  Grid2x2,
  Mic,
  Music2,
  Piano,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Split,
  Users,
  Volume2,
  Waves,
  Cpu,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/synclab/app-state";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import synclabLogoAsset from "@/assets/synclab-logo.jpg.asset.json";
import { toast } from "sonner";

const FEATURES: { icon: React.ReactNode; title: string; body: string }[] = [
  { icon: <Sparkles className="size-4" />, title: "AI Vocal Forge", body: "Write lyrics, pick a voice, land it on the beat." },
  { icon: <Split className="size-4" />, title: "Stem Separation", body: "Pull vocals, drums, bass and more out of a mix." },
  { icon: <Volume2 className="size-4" />, title: "Voice Remover", body: "Make an instrumental from any track." },
  { icon: <Bot className="size-4" />, title: "AI Co-Producer", body: "Ask for a bassline, a breakdown, harder drums." },
  { icon: <Waves className="size-4" />, title: "Hum to Beat", body: "Hum or beatbox a rhythm, get a real drum pattern." },
  { icon: <Music2 className="size-4" />, title: "Synthesizers", body: "Three oscillators, filters, envelopes, LFOs, arp." },
  { icon: <Disc3 className="size-4" />, title: "Drum Machine", body: "Hardware-style pads and a deep step sequencer." },
  { icon: <Grid2x2 className="size-4" />, title: "Beat Maker", body: "Pads, patterns, resampling, straight to the timeline." },
  { icon: <Scissors className="size-4" />, title: "Sample Chopper", body: "Slice by transient, beat or bar onto pads." },
  { icon: <AudioLines className="size-4" />, title: "Sampler", body: "Map any sound across the keyboard." },
  { icon: <Mic className="size-4" />, title: "Multi-Track Recording", body: "Every take on its own channel, with takes and punch." },
  { icon: <Piano className="size-4" />, title: "MIDI Recording", body: "Play your controller straight into the piano roll." },
  { icon: <SlidersHorizontal className="size-4" />, title: "Professional Mixer", body: "Buses, sends, inserts and real meters." },
  { icon: <Users className="size-4" />, title: "Mastering", body: "Finish loud, clean and ready to share." },
  { icon: <Cpu className="size-4" />, title: "Plugin Support", body: "Built-in effects now, native bridge architecture ready." },
];

export function WelcomeScreen() {
  const { setStage, setSignedIn } = useApp();
  const [mode, setMode] = useState<"signin" | "signup" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const enterStudio = () => {
    setSignedIn(true);
    setStage("start");
  };

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) enterStudio();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) enterStudio();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast("Check your email", { description: "Confirm your address, then sign in." });
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Sign-in failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 py-12">
        <header className="flex flex-col items-center text-center">
          <img
            src={synclabLogoAsset.url}
            alt="SYNCLAB"
            className="h-48 w-48 rounded-lg object-contain shadow-[var(--shadow-glow)] sm:h-56 sm:w-56"
          />
          <h1 className="mt-7 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Create. Record. Produce. Finish.
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-sm text-muted-foreground sm:text-base">
            SYNCLAB combines AI music creation with a complete recording studio — one screen, one project, one
            timeline. Simple enough to start, powerful enough to finish.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Button size="lg" className="glow font-display tracking-wide" onClick={() => setMode("signup")}>
              START FREE TRIAL
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setMode("signin")}>
              SIGN IN
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setMode("signup")}>
              CREATE ACCOUNT
            </Button>
            <Button size="lg" variant="ghost" onClick={() => void oauth("google")}>
              CONTINUE WITH GOOGLE
            </Button>
            <Button size="lg" variant="ghost" onClick={() => void oauth("apple")}>
              CONTINUE WITH APPLE
            </Button>
          </div>

          {mode && (
            <form onSubmit={submit} className="panel mt-6 w-full max-w-sm space-y-3 p-5 text-left">
              <h2 className="font-display text-sm font-semibold tracking-wide">
                {mode === "signup" ? "CREATE YOUR ACCOUNT" : "SIGN IN"}
              </h2>
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "WORKING…" : mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
              </button>
            </form>
          )}

          <p className="mt-3 font-mono text-[10px] tracking-widest text-muted-foreground/70 uppercase">
            7-day free trial · no card needed yet
          </p>
        </header>


        <section className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="panel flex gap-3 p-4">
              <span className="mt-0.5 text-primary">{f.icon}</span>
              <div>
                <h2 className="font-display text-sm font-semibold tracking-wide">{f.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{f.body}</p>
              </div>
            </article>
          ))}
        </section>

        <footer className="mt-10 text-center font-mono text-[10px] tracking-[0.35em] text-muted-foreground/60 uppercase">
          SYNCLAB · Detroit Electronic Sound Design
        </footer>
      </div>
    </div>
  );
}
