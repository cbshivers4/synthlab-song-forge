# SYNCLAB

**CREATE. RECORD. PRODUCE. FINISH.**

SYNCLAB is a web, desktop and mobile digital audio workstation. Record vocals and
instruments, build beats with the drum machine and piano roll, arrange on the timeline, mix with
buses, sends, VCA groups and mastering, and finish the song — then export it.

- **Product:** SYNCLAB
- **Version:** 1.0.0
- **Desktop app id:** `com.synclab.vocalforge`
- **Publisher:** SYNCLAB, Detroit, Michigan — support contact is set once in `src/lib/synclab/contact.ts` (`SUPPORT_EMAIL`) and shown in the app's Help Center
- **Payments:** Paddle (merchant of record). 14-day free trial (card required; cancel before day 14 and nothing is charged), then $9.95/month or $119.40/year. Free version: no project saving.
  The founder account keeps lifetime access.

## What is in the repo

```
src/                     React app (TanStack Start)
  routes/                pages: studio, pricing, privacy, refunds, terms, api
  components/studio/     transport, timeline, mixer, device bar, piano roll, sampler, live view
  lib/synclab/           audio engine, timebase, presets, MIDI, looper, bounce/export, plans
electron/                desktop shell: window, menu, preload bridge, plug-in scanner, app identity
public/                  favicon, robots, sitemap, desktop release metadata
scripts/                 desktop build tooling
supabase/                database, auth, storage (Lovable Cloud)
```

## Running it

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd synclab
npm i
npm run dev
```

Desktop builds (macOS/Windows) are described in `DESKTOP_BUILD.md`.

## Stack

- TanStack Start (React 19, Vite)
- Web Audio API + Web MIDI
- Tailwind CSS v4
- TypeScript
- Electron for the desktop app
