/**
 * The 30-day "why SYNCLAB" campaign for accounts that haven't picked a plan yet.
 * The emails are written here and shown on the founder dashboard; Loops sends them
 * (a Loop triggered by the CAMPAIGN_EVENT, each email filtered to isPaid = false so
 * it stops the moment someone pays). Every claim matches what the app really does.
 */
import { PLAN_PRICES, TRIAL_DAYS } from "@/lib/synclab/plan-tier";

/** Loops event that starts the campaign for one contact. */
export const CAMPAIGN_EVENT = "campaign_start";
/** Loops event sent when an account starts a trial or pays. */
export const PAID_EVENT = "plan_paid";
export const CAMPAIGN_DAYS = 30;
export const PRICING_URL = "https://synclabsapp.com/pricing";
export const STUDIO_URL = "https://synclabsapp.com";

export interface CampaignEmail {
  /** Days after the campaign starts (0 = right away). */
  day: number;
  subject: string;
  preview: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  cta: { label: string; url: string };
}

const monthly = PLAN_PRICES.monthly.label;
const yearly = PLAN_PRICES.yearly.label;
const SIGN_OFF = "— The SYNCLAB team, Detroit";

export const CAMPAIGN_EMAILS: CampaignEmail[] = [
  {
    day: 0,
    subject: "Welcome to SYNCLAB — your studio is ready",
    preview: "Everything you need to make a full track, in your browser.",
    heading: "Welcome to the studio",
    paragraphs: [
      "Hi there,",
      "Thanks for joining SYNCLAB. You now have a full music studio that opens in your browser on your computer, tablet or phone — no installs.",
      "Over the next few weeks we'll send you short tips on the tools most people miss. Today, just open the studio and press play on a starter template.",
      SIGN_OFF,
    ],
    cta: { label: "Open the studio", url: STUDIO_URL },
  },
  {
    day: 1,
    subject: "Make a beat in 5 minutes",
    preview: "Drum machines, step patterns and the drum roll.",
    heading: "Your first beat",
    paragraphs: [
      "Hi there,",
      "Add a drum track, pick a kit, and tap steps on the pads. Double-tap the track on the timeline to open the drum roll and edit every hit.",
      SIGN_OFF,
    ],
    bullets: [
      "Vintage-style drum machine kits, each with its own sound",
      "Eight patterns per kit, swing and note repeat",
      "Live Drummer plays a real-feel groove along with your song",
    ],
    cta: { label: "Make a beat", url: STUDIO_URL },
  },
  {
    day: 3,
    subject: "Synths, bass and keys — all built in",
    preview: "Hundreds of presets, a piano roll and a Bass Generator.",
    heading: "Play real instruments",
    paragraphs: [
      "Hi there,",
      "SYNCLAB comes with synths, a sampler, a Touch Synth X/Y pad and a Bass Generator that writes a bassline to fit your song. Play them with your computer keyboard, the on-screen keys or a MIDI keyboard.",
      SIGN_OFF,
    ],
    bullets: [
      "Categorised presets, including piano sounds in every synth",
      "Piano roll with box select, drag and nudge",
      "Live Keys plays chords along with your track",
    ],
    cta: { label: "Try the instruments", url: STUDIO_URL },
  },
  {
    day: 5,
    subject: "Record your voice or guitar",
    preview: "Record takes, loop passes and clean recordings.",
    heading: "Record like a real studio",
    paragraphs: [
      "Hi there,",
      "Plug in a microphone or audio interface, arm a track and record. Loop a section to record several takes, then keep the best one.",
      "Tip: use headphones while recording so the speakers don't leak into the mic.",
      SIGN_OFF,
    ],
    cta: { label: "Start recording", url: STUDIO_URL },
  },
  {
    day: 7,
    subject: "One week in — don't lose your work",
    preview: `The free version can't save projects. Pro can, from ${monthly}/month.`,
    heading: "Keep every song you make",
    paragraphs: [
      "Hi there,",
      "You've had SYNCLAB for a week. One thing to know: the free version can't save projects, so a closed tab means a lost song.",
      `Pro saves your projects to your account so you can reopen them on any device. Start with a ${TRIAL_DAYS}-day free trial — nothing is charged until day ${TRIAL_DAYS}, and you can cancel before then.`,
      SIGN_OFF,
    ],
    cta: { label: `Start your ${TRIAL_DAYS}-day free trial`, url: PRICING_URL },
  },
  {
    day: 10,
    subject: "Mix like a pro: buses, VCAs and effects",
    preview: "A full mixer with effect racks on every channel.",
    heading: "A real mixing desk",
    paragraphs: [
      "Hi there,",
      "Open the mixer to set levels, pan and EQ on every channel. Build effect buses like a Vocal Chain, and group channels on a VCA fader that moves them together.",
      SIGN_OFF,
    ],
    bullets: [
      "Dozens of rack effects with their own presets",
      "Guitar and bass amps and pedals",
      "Meters and scopes on every channel",
    ],
    cta: { label: "Open the mixer", url: STUDIO_URL },
  },
  {
    day: 13,
    subject: "Pull any song apart into stems",
    preview: "Separate vocals, drums, bass and more.",
    heading: "Stem separation",
    paragraphs: [
      "Hi there,",
      "Load a song into Separate Stems and pull out the vocals, drums, bass and other parts — even individual drum pieces like kick, snare and hi-hat. Then add them to your timeline to remix or practise along.",
      "AI tools have a daily limit per account. Separation is very good but can't promise zero bleed on every song.",
      SIGN_OFF,
    ],
    cta: { label: "Separate a song", url: STUDIO_URL },
  },
  {
    day: 16,
    subject: "Your AI Co-Producer",
    preview: "Ideas for chords, drums and arrangement when you're stuck.",
    heading: "Never stare at an empty timeline",
    paragraphs: [
      "Hi there,",
      "Stuck? Ask the AI Co-Producer for chord ideas, drum patterns or what to add next. Or hum a melody and turn it into a beat with Hum to Beat.",
      SIGN_OFF,
    ],
    cta: { label: "Ask the Co-Producer", url: STUDIO_URL },
  },
  {
    day: 20,
    subject: "Finish your track: mastering and Sound Check",
    preview: "Master your song and hear it in a car, a club and more.",
    heading: "Make it sound finished",
    paragraphs: [
      "Hi there,",
      "The mastering suite makes your mix louder and more polished. Then use Sound Check to hear how it plays in a car, a club, on a Walkman, at home and more.",
      "Exporting finished WAV and MP3 files and saving mastered files are part of Pro.",
      SIGN_OFF,
    ],
    cta: { label: "See Pro features", url: PRICING_URL },
  },
  {
    day: 24,
    subject: "Record to tape, cassette and CD",
    preview: "Reel-to-reel, cassette deck and a CD burner — in your browser.",
    heading: "Old-school warmth",
    paragraphs: [
      "Hi there,",
      "The Tape & CD Recorder lets you record your mix to a reel-to-reel, a cassette with two sides, or build a CD track list ready for your computer's disc burner. Name your tapes and keep them on your shelf.",
      SIGN_OFF,
    ],
    cta: { label: "Open the Tape & CD Recorder", url: STUDIO_URL },
  },
  {
    day: 27,
    subject: "Your songs, on every device",
    preview: "Start on your computer, finish on your phone.",
    heading: "One account, all your devices",
    paragraphs: [
      "Hi there,",
      "With Pro your projects are saved to your account, so you can start a song on your computer and keep working on your phone or tablet.",
      `Pro is ${monthly} a month, or ${yearly} a year. Try it free for ${TRIAL_DAYS} days first.`,
      SIGN_OFF,
    ],
    cta: { label: "Choose a plan", url: PRICING_URL },
  },
  {
    day: 30,
    subject: "Ready to finish your first song?",
    preview: `Save, export and master with Pro — ${TRIAL_DAYS} days free.`,
    heading: "Everything you need to finish",
    paragraphs: [
      "Hi there,",
      "Over the last month you've seen what SYNCLAB can do. Pro unlocks the parts that turn ideas into finished songs:",
      `Start your ${TRIAL_DAYS}-day free trial today. Nothing is charged until day ${TRIAL_DAYS}, and you can cancel any time before.`,
      SIGN_OFF,
    ],
    bullets: [
      "Save projects to your account and reopen them anywhere",
      "Export finished WAV and MP3 files",
      "Save mastered files from the mastering suite",
    ],
    cta: { label: `Start your free trial`, url: PRICING_URL },
  },
];

/** Plain-text version of one email, for pasting into the Loops editor. */
export function campaignEmailText(e: CampaignEmail): string {
  const lines = [e.heading, "", ...e.paragraphs.slice(0, -1)];
  if (e.bullets?.length) lines.push("", ...e.bullets.map((b) => `• ${b}`));
  lines.push("", `${e.cta.label}: ${e.cta.url}`, "", e.paragraphs[e.paragraphs.length - 1] ?? "");
  return lines.join("\n");
}

/** The email due on a given campaign day (the latest one not after it), or null before day 0. */
export function emailForDay(day: number | null): CampaignEmail | null {
  if (day === null || day < 0) return null;
  let due: CampaignEmail | null = null;
  for (const e of CAMPAIGN_EMAILS) if (e.day <= day) due = e;
  return due;
}
