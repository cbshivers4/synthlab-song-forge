// ============= Full file contents =============

import {
  AudioLines,
  Disc3,
  Grid2x2,
  Mic,
  Music2,
  Piano,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  Cpu,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/synclab/app-state";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
import studioPhoto from "@/assets/hw-synth.jpg";
import { toast } from "sonner";
import { LegalFooter } from "@/components/legal/LegalPage";
import { openHelp } from "@/components/studio/HelpCenter";


const FEATURES: { icon: React.ReactNode; title: string; body: string }[] = [
  { icon: <Sparkles className="size-4" />, title: "AI Co-Producer", body: "Writes chords, basslines, drum patterns and lyrics — preview against your song, then add it to the timeline." },
  { icon: <Wand2 className="size-4" />, title: "Generate Stem — Coming soon", body: "Not available now. Describe a part and get a solo audio stem in your key and tempo." },
  { icon: <AudioLines className="size-4" />, title: "Separate Stems — Coming soon", body: "Not available now. Split any song into vocals, drums, bass or instrumental." },
  { icon: <Mic className="size-4" />, title: "Hum to Beat & Convert Voice", body: "Beatbox a rhythm or hum a melody into notes, and restyle recorded vocals with 21 voice templates." },
  { icon: <Music2 className="size-4" />, title: "Four Synthesizers", body: "Spec 4, Acid Bass (TD-3 style) with step write, Poly Synth and a patchable Modular Tech rack." },
  { icon: <Cpu className="size-4" />, title: "Modular Tech Synth", body: "Build your own rack — VCOs, filters, envelopes, mixers — and patch it with colour cables." },
  { icon: <Disc3 className="size-4" />, title: "Drum Machine & Drum Roll", body: "24 kits with step sequencing, per-step pitch, chance, flam and choke groups." },
  { icon: <Grid2x2 className="size-4" />, title: "Pad Sampler & Chopper", body: "64 pads, live mic sampling, slice any MP3 or WAV to pads and keys." },
  { icon: <Scissors className="size-4" />, title: "Video Sampler", body: "Chop video to pads, trigger clips from keys or MIDI, and record straight from your camera." },
  { icon: <Disc3 className="size-4" />, title: "Reel-to-Reel Recorder", body: "16 input channels with analog meters, mute and solo, tape saturation and WAV/MP3 export." },
  { icon: <SlidersHorizontal className="size-4" />, title: "Pro Mixer & Effects Rack", body: "Buses, sends, VCA groups, aux returns, rack-mounted effects with live scopes and meters." },
  { icon: <Piano className="size-4" />, title: "Studio View & MIDI Learn", body: "See your gear on stands and racks, and map any knob, fader or pad on your controller." },
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
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "magic" | null>(null);
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

  const friendlyError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Invalid login credentials")) return "Wrong email or password. Try again, or use Forgot password below.";
    if (msg.includes("Email not confirmed")) return "Confirm your email first — check your inbox for the confirmation link.";
    if (msg.includes("rate limit") || msg.includes("too many")) return "Too many emails right now. Wait a minute and try again.";
    if (msg.includes("at least 6")) return "Password must be at least 6 characters.";
    if (msg.includes("already registered")) return "That email already has an account — sign in instead.";
    if (msg.includes("valid email")) return "Enter a valid email address.";
    return err instanceof Error ? err.message : "Something went wrong. Try again.";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email", { description: "We sent you a password-reset link. Open it on this device to set a new password." });
        setMode("signin");
        return;
      }
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email", { description: "We sent a sign-in link. Open it on this device — no password needed." });
        setMode(null);
        return;
      }
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
      toast.error(friendlyError(err));
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
    <div className="login-screen min-h-[100dvh] overflow-y-auto bg-background text-foreground">
      <img src={studioPhoto} alt="" className="login-photo" />
      <div className="login-inner mx-auto grid w-full grid-cols-1 items-center gap-8 px-5 py-8 sm:px-8 sm:py-12 md:grid-cols-2 lg:gap-16">
        {/* Brand & features side */}
        <div className="login-brand flex min-w-0 flex-col items-start text-left">
          <img src={synclabLogoAsset.url} alt="SYNCLAB" className="login-logo rounded-xl border border-border object-cover" />


          <div className="login-brand-copy mb-5 space-y-4">
            <h1 className="sr-only">SYNCLAB — CREATE. RECORD. PRODUCE. FINISH.</h1>
            <p className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">

              CREATE. RECORD.
              <br />
              PRODUCE.{" "}
              <span className="text-primary">FINISH.</span>
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Detroit Electronic Sound Design
            </p>
          </div>

          <ul className="hidden w-full grid-cols-2 gap-x-4 gap-y-3 md:grid">
            {FEATURES.map((f) => (
              <li key={f.title} className="group flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-[7px] size-1.5 shrink-0 rotate-45 bg-primary transition-colors group-hover:bg-foreground"
                />
                <div className="min-w-0 text-sm leading-snug">
                  <div className="font-semibold text-foreground">{f.title}</div>
                  <div className="text-muted-foreground">{f.body}</div>
                </div>
              </li>
            ))}
          </ul>

          <footer className="mt-6 hidden w-full border-t border-border pt-6 font-mono text-[10px] uppercase text-muted-foreground/50 sm:block">
            SYNCLAB · Detroit Electronic Sound Design
          </footer>
        </div>

        {/* Auth side */}
        <div className="min-w-0">
          <div className="login-auth overflow-hidden rounded-lg border border-border p-5 sm:p-7">
            <h2 className="mb-1 font-display text-2xl font-semibold">Your studio awaits.</h2>
            <p className="mb-6 text-sm text-muted-foreground">Sign in to SYNCLAB</p>
            <div className="space-y-6">
              <div className="space-y-4">
                <Button className="min-h-14 w-full text-base font-bold" onClick={() => setMode("signup")}>
                  START FREE TRIAL
                </Button>
                <p className="text-center text-xs font-medium text-muted-foreground">
                  7-day free trial · no card needed yet
                </p>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="rounded-full border border-border bg-background px-4 py-1 text-muted-foreground">or secure login</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button variant="outline" className="relative min-h-12 w-full font-bold" onClick={() => void oauth("google")}>
                  <span className="absolute left-5 flex items-center">{GOOGLE_ICON}</span>
                  CONTINUE WITH GOOGLE
                </Button>
                <Button variant="secondary" className="relative min-h-12 w-full font-bold" onClick={() => void oauth("apple")}>
                  <span className="absolute left-5 flex items-center">{APPLE_ICON}</span>
                  CONTINUE WITH APPLE
                </Button>
              </div>

              {mode ? (
                <form onSubmit={submit} className="space-y-3 pt-2">
                  <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "magic" ? "Sign in with an email link" : "Sign in"}
                  </h2>
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {mode !== "forgot" && mode !== "magic" && (
                    <Input
                      type="password"
                      required
                      minLength={6}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  )}
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "WORKING…" : mode === "signup" ? "CREATE ACCOUNT" : mode === "forgot" ? "SEND RESET LINK" : mode === "magic" ? "SEND SIGN-IN LINK" : "SIGN IN"}
                  </Button>
                  {mode === "signin" && (
                    <Button
                      variant="link"
                      type="button"
                      className="w-full text-center text-xs text-muted-foreground"
                      onClick={() => setMode("forgot")}
                    >
                      Forgot password?
                    </Button>
                  )}
                  {mode === "forgot" && (
                    <Button
                      variant="link"
                      type="button"
                      className="w-full text-center text-xs text-muted-foreground"
                      onClick={() => setMode("signin")}
                    >
                      Back to sign in
                    </Button>
                  )}
                  {mode === "magic" && (
                    <Button
                      variant="link"
                      type="button"
                      className="w-full text-center text-xs text-muted-foreground"
                      onClick={() => setMode("signin")}
                    >
                      Back to sign in
                    </Button>
                  )}
                  {mode !== "forgot" && mode !== "magic" && (
                    <Button
                      variant="link"
                      type="button"
                      className="min-h-11 w-full text-center text-xs text-muted-foreground"
                      onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                    >
                      {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
                    </Button>
                  )}
                </form>
              ) : (
                <div className="flex flex-col gap-4 pt-4">
                  <Button
                    variant="outline"
                    className="min-h-12 w-full font-bold"
                    onClick={() => setMode("signin")}
                  >
                    SIGN IN
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11 w-full text-sm font-semibold text-muted-foreground"
                    onClick={() => setMode("signup")}
                  >
                    CREATE ACCOUNT
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11 w-full text-xs font-semibold text-muted-foreground underline underline-offset-2"
                    onClick={() => setMode("magic")}
                  >
                    Email me a sign-in link instead
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Free for 7 days, then $19.95/month or $149/year.
            </p>
            <LegalFooter className="mt-3" />
            <Button variant="link"
              type="button"
              onClick={() => openHelp("help")}
              className="mt-2 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              SYNCLAB Help Center
            </Button>
          </div>
        </div>
      </div>
    </div>

  );
}
