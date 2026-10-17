import { supabase } from "@/integrations/supabase/client";

export const SYNCLAB_VERSION = "1.0.0";
export const SYNCLAB_NAME = "SYNCLAB";
export const SYNCLAB_TAGLINE = "Create. Record. Produce. Finish.";

export type SupportSettings = {
  support_email: string;
  support_website: string;
  help_center_url: string;
  knowledge_base_url: string;
  terms_url: string;
  privacy_url: string;
  status_url: string;
  community_url: string;
  tutorials_url: string;
};

export const EMPTY_SETTINGS: SupportSettings = {
  support_email: "",
  support_website: "",
  help_center_url: "",
  knowledge_base_url: "",
  terms_url: "/terms",
  privacy_url: "/privacy",
  status_url: "",
  community_url: "",
  tutorials_url: "",
};

export async function loadSupportSettings(): Promise<SupportSettings> {
  const { data, error } = await supabase
    .from("support_settings")
    .select(
      "support_email,support_website,help_center_url,knowledge_base_url,terms_url,privacy_url,status_url,community_url,tutorials_url",
    )
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return EMPTY_SETTINGS;
  return { ...EMPTY_SETTINGS, ...(data as Partial<SupportSettings>) };
}

export async function saveSupportSettings(s: SupportSettings): Promise<string | null> {
  const { error } = await supabase
    .from("support_settings")
    .update({ ...s, updated_at: new Date().toISOString() })
    .eq("id", true);
  return error ? error.message : null;
}

export async function isSupportAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export type TicketInput = {
  kind: "support" | "problem";
  name: string;
  email: string;
  category: string;
  subject: string;
  description: string;
  expected?: string;
  steps?: string;
  project_name?: string;
  diagnostics?: Record<string, unknown>;
};

export async function submitTicket(userId: string, t: TicketInput): Promise<string | null> {
  const { error } = await supabase.from("support_tickets").insert({
    user_id: userId,
    kind: t.kind,
    name: t.name,
    email: t.email,
    category: t.category,
    subject: t.subject,
    description: t.description,
    expected: t.expected ?? "",
    steps: t.steps ?? "",
    project_name: t.project_name ?? "",
    diagnostics: (t.diagnostics ?? {}) as never,
  });
  return error ? error.message : null;
}

export function collectDiagnostics(extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (typeof window === "undefined") return { version: SYNCLAB_VERSION, ...extra };
  const ua = navigator.userAgent;
  const os = /Mac/i.test(ua)
    ? "macOS"
    : /Windows/i.test(ua)
      ? "Windows"
      : /Android/i.test(ua)
        ? "Android"
        : /iPhone|iPad/i.test(ua)
          ? "iOS"
          : "Other";
  const device = /iPhone|Android.*Mobile/i.test(ua) ? "Phone" : /iPad|Tablet/i.test(ua) ? "Tablet" : "Desktop";
  return {
    version: SYNCLAB_VERSION,
    runtime: "Web browser (SYNCLAB Desktop not installed)",
    os,
    device,
    browser: ua,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    audio_engine: "Web Audio",
    native_plugins: "unavailable in browser",
    ...extra,
  };
}

export type Article = { id: string; title: string; tags: string; body: string[] };

export const KNOWLEDGE_BASE: Article[] = [
  {
    id: "recording",
    title: "Recording audio and vocals",
    tags: "recording microphone vocals input monitor arm punch take",
    body: [
      "Add an audio track, press ● ARM on it, and SYNCLAB opens your microphone so you can hear and see the input level before you record.",
      "Press Record in the transport. If Count-in is on, you hear the bars you selected click through first, then recording starts.",
      "Each pass creates a new take. Loop recording keeps every take so you can pick the best one; punch in/out limits recording to the loop region.",
      "If the level meter turns red, the signal is clipping — turn the input gain down at your interface.",
    ],
  },
  {
    id: "mic",
    title: "My microphone or audio interface is not detected",
    tags: "mic microphone volt interface permission device audio input blocked",
    body: [
      "Open Settings → Audio and pick your input device. Interfaces such as the Volt 1 appear once they are plugged in and the browser has permission.",
      "If the browser blocked the microphone, allow it in the address bar and reload. Inside an embedded preview, use Open in tab first — embedded frames cannot always request the microphone.",
      "Only one application can hold an interface at a time on some systems. Close other audio apps and try again.",
      "The browser cannot set buffer size or sample rate on your interface. That requires SYNCLAB Desktop.",
    ],
  },
  {
    id: "midi",
    title: "MIDI controllers and keyboards",
    tags: "midi controller keyboard cc learn clock sync device",
    body: [
      "Open Settings → MIDI and enable your controller. Once chosen, SYNCLAB reconnects to it automatically the next time you open the app, and after you unplug and replug it.",
      "Use MIDI Learn on a mixer or device control, then move a knob on your controller to map it.",
      "Web MIDI works in Chromium-based browsers. Safari and most mobile browsers do not expose MIDI devices; SYNCLAB says so rather than pretending to connect.",
    ],
  },
  {
    id: "plugins",
    title: "VST, AU and plugins",
    tags: "vst au vst3 clap plugin scan bridge native desktop",
    body: [
      "Browsers cannot scan your plugin folders or run native VST3/AU/CLAP code — no web app can, regardless of what it claims.",
      "SYNCLAB ships built-in instruments and effects that run in the browser, plus the SYNCLAB Plugin Bridge architecture for the desktop build.",
      "When SYNCLAB Desktop is installed, Settings → Plugins performs a real scan of your plugin folders and opens plugin windows. Until then, the browser states clearly that native plugin access is unavailable.",
    ],
  },
  {
    id: "sampler",
    title: "Sampler: loading, trimming and time stretch",
    tags: "sampler sample trim stretch pitch loop adsr map chop",
    body: [
      "Drop an audio file onto the sampler, or record straight into a pad.",
      "Drag the start and end handles on the waveform to trim. Trimming is non-destructive — the original file is never altered.",
      "Time stretch changes length without changing pitch; pitch changes tone without changing length. Extreme settings will sound processed.",
      "ADSR, filter, velocity and key tracking shape how each note plays from your keyboard.",
    ],
  },
  {
    id: "chopper",
    title: "Chopping samples onto pads",
    tags: "chop slice transient pads bars divisions mpc",
    body: [
      "Choose transient, beat, bar or equal division chopping, or place slices by hand.",
      "Pick 4, 8, 16 or 32 slices; each lands on its own pad with its own colour and waveform.",
      "Pads can be rearranged, reversed, pitched, stretched and faded individually.",
    ],
  },
  {
    id: "vocoder",
    title: "Vocoder",
    tags: "vocoder robot carrier modulator formant bands",
    body: [
      "Pick a carrier (usually a synth) and a modulator (usually a voice). The vocoder imposes the voice's shape on the synth.",
      "Bands controls resolution, formant shifts the character, and dry/wet blends with the untouched signal.",
    ],
  },
  {
    id: "pianoroll",
    title: "Piano roll and timing",
    tags: "piano roll notes quantize grid snap timeline position bars beats",
    body: [
      "Draw, move, resize and delete notes; velocity and automation lanes sit below the grid.",
      "Everything — piano roll, timeline, clips and playhead — uses one project timebase in sixteenth steps, so a note at bar 3 beat 1 shows at bar 3 beat 1 everywhere.",
      "Quantize snaps notes to the grid; humanize pushes them slightly off it again.",
    ],
  },
  {
    id: "timeline",
    title: "Timeline, loop markers and automation",
    tags: "timeline loop markers automation sections arrangement snap zoom",
    body: [
      "Drag the loop markers at the top of the timeline, or drag the band between them to move the whole loop. Arrow keys nudge a selected marker.",
      "AUTO on a track shows automation lanes for volume, pan, sends and device parameters. Points can be dragged, curved, copied and locked.",
      "Song sections (intro, verse, chorus, drop and so on) can be created, renamed, moved, duplicated and looped.",
    ],
  },
  {
    id: "mixer",
    title: "Mixer, buses and sends",
    tags: "mixer bus send return fader pan mute solo eq routing",
    body: [
      "Each channel has a fader, pan, mute, solo, EQ with a live waveform behind it, sends and routing.",
      "Send a track to a bus from the track menu on the timeline or the channel menu in the mixer.",
      "Meters are green and turn red only when the signal clips.",
    ],
  },
  {
    id: "mastering",
    title: "Mastering",
    tags: "master mastering loudness lufs limiter club streaming",
    body: [
      "Mastering measures loudness and peaks, then applies EQ, width, glue, drive and limiting.",
      "Presets cover streaming, club, Detroit and vocal-forward targets. A/B compares against the unprocessed mix.",
      "Processing is non-destructive until you save or export the mastered file.",
    ],
  },
  {
    id: "export",
    title: "Exporting WAV, MP3 and stems",
    tags: "export wav mp3 stems bounce render share",
    body: [
      "Set the export flags on the timeline to choose a region, or export the whole song.",
      "Choose WAV for quality or MP3 for sharing. Progress is shown while it renders.",
      "Exporting, saving mastered files and cloud saving are Pro features after the 7-day trial.",
    ],
  },
  {
    id: "desktop",
    title: "SYNCLAB Desktop (macOS and Windows)",
    tags: "desktop mac windows download install native offline latency",
    body: [
      "SYNCLAB Desktop is the native build. It adds low-latency audio device control, real MIDI ports, native VST3/AU plugin hosting, local file access and offline work.",
      "The desktop app is not a browser window around the website — the interface talks to a native audio and MIDI engine.",
      "Projects are shared between web and desktop. If a project uses a desktop-only feature, SYNCLAB tells you instead of silently dropping it.",
    ],
  },
  {
    id: "mobile",
    title: "Phones and tablets",
    tags: "mobile phone ipad iphone android tablet touch",
    body: [
      "On a phone SYNCLAB opens a touch layout: big drum pads, a step grid, the synth keyboard and the mic tab.",
      "Tablets get the full workflow with larger touch targets.",
      "Browsers on phones limit microphone and MIDI access; SYNCLAB reports what your device allows rather than hiding it.",
    ],
  },
  {
    id: "projects",
    title: "Saving, recovery and account",
    tags: "save manual save recovery cloud recent rename account billing trial",
    body: [
      "Projects are saved only when you choose File → Save (or press Ctrl/Cmd+S); nothing is saved automatically, so save before closing. Saved projects appear in Recent and cloud projects, where they can be renamed or deleted from the start screen.",
      "Billing, invoices and cancellation are handled by Paddle. Open the upgrade panel and choose Manage billing.",
    ],
  },
];

export function searchArticles(q: string): Article[] {
  const t = q.trim().toLowerCase();
  if (!t) return KNOWLEDGE_BASE;
  return KNOWLEDGE_BASE.filter(
    (a) =>
      a.title.toLowerCase().includes(t) ||
      a.tags.includes(t) ||
      a.body.some((p) => p.toLowerCase().includes(t)),
  );
}
