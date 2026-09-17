// ============= Full file contents =============

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
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
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

const GOOGLE_ICON = (
  <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const APPLE_ICON = (
  <svg className="size-5 fill-current" viewBox="0 0 24 24" aria-hidden>
    <path d="M17.05 20.28c-.98.95-2.05 1.79-3.72 1.79-1.63 0-2.21-1.02-4.14-1.02-1.97 0-2.64 1-4.04 1-1.59 0-2.73-1.58-3.72-3.01-2.02-2.92-3.57-8.25-1.5-11.83.99-1.77 2.81-2.89 4.81-2.89 1.54 0 2.62.91 3.73.91 1.05 0 2.51-1.09 4.38-1.09 1.29 0 3.16.48 4.39 2.09-3.48 1.94-2.92 6.51.59 7.94-.91 2.29-2.29 4.67-3.78 6.11zM13 1c0 2.1-1.63 4.2-3.75 4.2-.2 0-.41-.02-.6-.05.15-2.31 1.87-4.15 3.55-5.15.35-.2.57-.28.8-.28V1z" />
  </svg>
);

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
    <div className="min-h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 py-12 lg:grid-cols-12">
        {/* Brand & features side */}
        <div className="flex flex-col items-center text-center lg:col-span-7 lg:items-start lg:text-left">
          <img
            src={synclabLogoAsset.url}
            alt="SYNCLAB"
            className="mb-10 h-24 w-24 rounded-2xl border border-white/20 object-cover shadow-[0_0_50px_-10px_hsl(var(--primary)/0.6)]"
          />

          <div className="mb-12 space-y-6">
            <h1 className="font-display text-5xl font-black leading-[0.9] tracking-tighter md:text-7xl">
              CREATE. RECORD.
              <br />
              PRODUCE.{" "}
              <span className="bg-gradient-to-r from-teal-400 to-purple-400 bg-clip-text text-transparent">
                FINISH.
              </span>
            </h1>
            <p className="max-w-md text-lg font-medium tracking-tight text-muted-foreground">
              The all-in-one workstation for the next generation of electronic sound design.
            </p>
          </div>

          <ul className="grid w-full grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="group flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-[7px] size-1.5 shrink-0 rotate-45 bg-primary transition-colors group-hover:bg-foreground"
                />
                <span className="text-sm leading-snug">
                  <span className="font-semibold text-foreground">{f.title}</span>
                  <span className="text-muted-foreground"> — {f.body}</span>
                </span>
              </li>
            ))}
          </ul>

          <footer className="mt-12 w-full border-t border-border pt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
            SYNCLAB · Detroit Electronic Sound Design
          </footer>
        </div>

        {/* Auth side */}
        <div className="lg:col-span-5">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-card/40 p-8 shadow-2xl backdrop-blur-2xl sm:p-10">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-teal-500/10 blur-3xl" />

            <div className="relative space-y-8">
              <div className="space-y-4">
                <button
                  className="w-full cursor-pointer rounded-2xl bg-teal-400 py-5 text-lg font-black tracking-wide text-black shadow-[0_0_30px_-5px_rgba(45,212,191,0.5)] transition-all hover:bg-teal-300 active:scale-[0.98]"
                  onClick={() => setMode("signup")}
                >
                  START FREE TRIAL
                </button>
                <p className="text-center text-xs font-medium text-muted-foreground">
                  7-day free trial · no card needed yet
                </p>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="bg-card px-4 text-muted-foreground">or secure login</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-white py-4 font-bold text-black transition-all hover:bg-zinc-100"
                  onClick={() => void oauth("google")}
                >
                  {GOOGLE_ICON}
                  CONTINUE WITH GOOGLE
                </button>
                <button
                  className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-zinc-800 py-4 font-bold text-white transition-all hover:bg-zinc-700"
                  onClick={() => void oauth("apple")}
                >
                  {APPLE_ICON}
                  CONTINUE WITH APPLE
                </button>
              </div>

              {mode ? (
                <form onSubmit={submit} className="space-y-3 pt-2">
                  <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {mode === "signup" ? "Create your account" : "Sign in"}
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
                    className="w-full cursor-pointer text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  >
                    {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-4 pt-4">
                  <button
                    className="w-full cursor-pointer rounded-xl border-2 border-border py-4 font-bold transition-colors hover:border-muted-foreground"
                    onClick={() => setMode("signin")}
                  >
                    SIGN IN
                  </button>
                  <button
                    className="w-full cursor-pointer py-2 text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                    onClick={() => setMode("signup")}
                  >
                    CREATE ACCOUNT
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
