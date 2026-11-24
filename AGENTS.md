<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Live Looper/View stay separate; singleton loops survive switching, bypass master to prevent recapture; timeline handles export/mastering.
Meters/loopers draw at 20 fps. HardwareBypass uses track.deviceBypassed in mix/scheduler separately from mute; effects use plugin bypass, video mutes media. Preserve notes/faders.
Mixer VCAs move their assigned channels' own faders, pans and EQ (vca-link.ts) so the controls visibly follow, while aux returns control post-effect levels before the master; this avoids routing returns back into their own sends.
Mixer meters tap real bus/return/VCA signals; master scales the mix and subgroups scale pre-bus sends.
MIDI: stable IDs, one hot-plug-safe multi-input subscription. Read nested AGENTS.md.
Timebase helpers use transport.beatsPerBar, synced each render, so all bar math agrees.
Timeline/razor share timelineUsesWaveform; exact cuts and portal menus stay in arrangement. Drags hit-test lanes/new-channel bounds with edge scrolling; atomic clip moves clear source notes/hits.
Bus/send insert edits crossfade parallel paths after the bus scope/send output; never disconnect active sources on parameter edits, which cuts live sound and bypasses effects.
Drum/sampler takes print live and replace overlapping clips unless overdub; synth (instrument/midi) takes record notes only (midiTakeRef, Overdub keeps looping with earlier passes audible) and land a waveform rendered offline from the notes through a flat channel copy, replacing older takes in its bars; recorded notes (recordedEnd) play once at their absolute step, and deleting a take erases the notes/hits under it, so nothing doubles or hides under a block.
- Computer typing keys (src/lib/synclab/qwerty.ts) play the armed/selected instrument via previewNote, which both sounds and captures notes; keep it the single note path so recording stays consistent.
Detached panels use synchronous user-click window.open + React portals for shared audio/state; child windows need draggable headers for monitor moves without reloads.
Bottom displays read live analyser taps at 20 fps; scopes magnify quiet signals only visually, while meters retain true float-sample dB levels. Generator waves use PCM/offline voices, never decoration; stem masks run in a worker for smooth playback.
Workspace retains cloud projects, device recents, saved/starter templates and storage/open actions.
- GRANT EXECUTE on RLS security-definer helpers to anon/authenticated/service_role; missing grants break policy reads.
Panel wallpaper uses bundled JPEG and per-panel skins.
Timeline names stay single-line; phone actions prioritize REC/AUTO with isolated menu clicks to avoid opening instruments.
Playhead stays within track rows; headers, ruler and song lane share its width variable, including large phone controls. It renders through the --playhead token (white, never dimmed) and stays draggable from ruler and track lanes.
Synth sections share wrapping tabs; X-Y pads dispatch through updatePatch to stay synchronized with knobs and saved presets without removing controls.
Read nested AGENTS.md in studio components and shared audio before changes.

Phone drum tabs reuse DrumRoll and instrument pads for edits/tap recording; sound/kit tabs preserve controls without duplication.
Keyboards reuse Keyboard and one note path; independent skin slots color opaque keys and wallpaper only the surround, preventing doubled notes.
Paste content at the playhead onto the selected or explicit channel, preserving its settings; Duplicate track separately clones channels.
Synth selection opens piano roll. Pin sampler waveform above Stretch/chops to keep cuts visible; PCM slices use previewNote for gate/choke.
Transport stays mounted: phone overlay and timeline use separate layout/paint containment with shared resize visibility; desktop transport stays below the workspace.
Phone shares desktop audio/state and native scrolling. AppProvider scopes phone tokens to the document; desktop prefs stay separate.
Phone Edit fits the screen without page scrolling: PhoneStudio divides the track area height into rows (--fit-row-h, touch-size minimum) and keeps an Add track menu in the Edit header; sideways DrumRoll shows all rows in one grid that scrolls inside itself (minmax(34px,1fr) rows, never page buttons); the rail still permits both pan axes for the rotated canvas.
Phone entry and workspace use a CSS sideways body canvas on portrait phone viewports, including body portals; use canvas-relative viewport sizing instead of JS innerHeight overrides so splash, dialogs and timeline stay in the same frame without requiring unsupported orientation locks.
Shared Popover/Select/DropdownMenu content uses lib/sideways-popper on the sideways canvas to place pop-ups beside their trigger in canvas space, because Radix measures screen-space rects and would draw them off-screen.
Sideways DrumRoll fits a flex-height panel using equal grid row tracks; selected-instrument note knobs use editInstrumentNotes for One note/All notes, preserving other pads, empty steps and loop boundaries rather than global pad sound changes.
Drum snap is session-only for new step writes, never existing hits.
Drum banks use pure helpers preserving IDs/samples; per-bank rhythm snapshots materialize hits into existing pads so editors/playback share state without changing sounds.
Legacy SYNCPADS bank cleanup is versioned in each track: preserve A, clear B–H once, and retain subsequent user additions through manual saves.
Learned drum triggers resolve saved track/pad IDs in the single MIDI subscription and consume mapped messages before normal note routing, preventing duplicate playback and recording.
MP3/MP4 imports/exports retain originals in the private library with content hashes to avoid duplicates; saved videos open Video Sampler.
Cloud deletion reads raw sessions, confirms deletion, then cleans owned files; missing assets cannot block removal.
Reel recorder: singleton worklet; playback bypasses master. Meters use post-master taps; exit releases input, keeps tape. Shared winding math uses capture duration and conserved tape area to match song length. Tape transport is independent of the song transport (never starts, stops or follows it). Cassette deck and CD burner reuse that one recorder via tape-media.ts (setTape swaps the medium, limit stops at side/disc end); CD burning exports WAV+CUE ZIP for the OS burner because browsers cannot drive optical drives.

Video cuts use source seconds/grid/clamp; kits save MIDI notes. Keyboard/learned MIDI share pad triggers; MIDI consumers prevent doubled track notes.

Device prefs use cache/events, not autosave/tick storage. Diagnostics preserve audio; unsupported controls stay read-only.

Recording-region helpers bound edits; patternRegion bounds drums. Captured notes are absolute.
Touch genre loops are pure MIDI compositions in touch-loop-library; load through patch.touch so editing and playback share state.
Project exits use AppProvider/ProjectCloseGuard on both layouts: compare musical snapshots and await recording before save-and-close to preserve manual saving.
Shortcuts share studio actions and yield to controls/claimed keys to avoid doubling.
Desktop workspace layout prefs (split view + timeline height, mixer dock + dock height in workspace-prefs.ts, timeline zoom, rail collapse/sections) are device-only localStorage, never project data; editors fill the workspace by default with split view opt-in, except the mixer, which docks under the timeline (Studio Pro style, F3 toggles) unless Full view is chosen.
Every paid AI server function reserves a use with reserveAiUse (src/lib/ai-quota.ts → consume_ai_use RPC) before calling the provider and refunds on provider failure, so the per-user daily limit is enforced server-side, never in the browser.
- Test mode (?test=1, lib/synclab/test-mode.ts) is read once at boot, never stored; it renders TestStages with TestPlanProvider, blocks every off-site/server request, and backend helpers early-return, so automation never touches accounts or saved data.
Plan rules live in src/lib/synclab/plan-tier.ts (pure, tested); paid trials are Paddle price trials (card required) and the no-card Free Access trial is a server-written free_access_trials row (start_free_access RPC, once per user), never a device-local timer. The database enforces saving via can_save_projects() in cloud_projects policies and AI via can_use_ai_tools() inside consume_ai_use, so client gates are never the only check.
Live Drummer, Live Keys and DJ Decks keep audio state in module singletons (drummer-player.ts, keyboardist-player.ts, dj-engine.ts) mounted once per layout, so switching panels or phone/desktop never restarts playback; details in src/lib/synclab/AGENTS.md.
- Live-captured notes (computer keys, on-screen keys, MIDI) snap to transport.quantize via snapRecordedStep unless transport.snapRecording === false, so synth takes and their rendered waveform start on grid lines.
Desktop timeline sits in React Activity, hidden while an editor fills the workspace, so edits don't re-render the invisible arrangement during playback.
AI assistants: the app-hosted MCP server (src/lib/mcp, OAuth, caller-scoped client so RLS applies) only reads/renames saved account data; live studio control is WebMCP in StudioAgentTools, which calls the same store/library actions as the UI (library-actions.ts) and never deletes, pays or shares.
Menu/track-menu/timeline-logo colours are device-only prefs in color-prefs.ts applied as <html> attributes; every shared menu surface carries .app-menu so portalled menus follow them without per-component styling.
Prettier/ESLint skip generated Supabase files, payment/webhook code, account deletion and Electron (.prettierignore + eslint override) so maintenance formatting never rewrites billing or security code.
Both Paddle webhook paths (/api/public/payments/webhook and legacy /api/public/paddle-webhook) call handlePaddleWebhook in src/lib/paddle-webhook.server.ts, verified by the Paddle SDK, and DB write errors return 400 so Paddle retries instead of losing the event.
- vite.config optimizeDeps.include pre-bundles server-function client deps so dev never reloads on the first server call.
- Scroll/play effects use braces (lint-enforced): Chrome scroll Promises returned as cleanup crash panels.
