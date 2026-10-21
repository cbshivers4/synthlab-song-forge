Drum pads fill five equal columns (`.drum-pad-grid` uses `repeat(5, minmax(0,1fr))`) and each cell stays exactly square through `aspect-ratio: 1/1` on the cell, so pads grow with the panel without ever clipping the sound-controls column; the sideways-phone grid keeps a fixed square variable (`--drum-pad-size`) with matching `grid-auto-rows` so its strip can scroll horizontally, and sampler pads keep sizing from `--sampler-pad-size`. Keep pad markup free of fixed/min heights so drum and sample pads always read as true squares on desktop and sideways phone.

Every mixer channel and the master strip carry a pre-fader GAIN knob (Track.gain / BusState.gain, 0–2, default 1) driving a dedicated trim GainNode between channel input and fader in the audio engine — never fold trim into the fader gain, or automation and VCA math break. MIDI learn accepts CC (knobs/faders) and note buttons (key `n:channel:pitch`, toggles mute/solo/arm on press only); mapped buttons must never play instrument notes. Meter ladders and VU faces keep a printed red/amber overload zone (unlit tinted segments, `vu-hot-band`) so the clipping region reads as hardware artwork, not a flat recolour.

# Studio components

EQ and Pro EQ share EqGrid and scoped eq-workstation/eq-chart tokens for their frequency-display presentation; keep response paths parameter-derived and analyser drawing at 20 fps, without changing DSP or adding simulated spectra.

TouchSynth keeps five lanes in patch.touch and uses shared previewNote/playDrum, one loop timer and a DOM playhead. Force poly preview voices so lanes overlap; align overdubs with that loop clock. Grid edits use placeLoopNote/eraseLoopNote to retain other notes; patch/lane changes preserve touch settings. Send to timeline reuses loopsToNotes without capture or extra engines. Desktop/phone shortcuts reuse a dedicated track and open its performance tab.

Hardware presentation uses shared Knob parts and CSS device tokens scoped by synth style/effect kind; indicators remain parameter/signal-driven and skins stay on the surround to preserve customization without simulated audio or duplicate controls.
Drum artwork uses semantic SVG; sort copies and banks by stable IDs so pad identity stays consistent.

WorkflowBar reuses shared recording, clipboard, take and routing actions; only explicit active clips/regions are part targets, so deleting a part never removes its channel. Keep the bar shared by phone and desktop without duplicating transport state.

Settings diagnostics snapshots only device preferences across explicit reloads; independent test capture is released and never takes shared studio mic ownership. Access checks never replace MIDI handlers or audio routing, so live work stays intact.
MIDI settings uses shared controller profiles and store input selection; illustrations distinguish available profiles from reported inputs, and category navigation remains alongside the panel to match the workstation reference without duplicate MIDI state.

SynthEditor derives instrument tabs from timeline track IDs and selects through the shared store; keep each track's editor keyed by its ID so switching preserves project patches without leaking local controls between synths.
Preset auditions pass the selected patch through previewNote with capture disabled, so immediate factory/user/modular previews never read a stale track patch or record test notes.

Effects Rack reuses track plugin instances and store actions with inline RackEffect modules; post-insert analyser scopes and shared 20 fps meter callbacks keep the rack tied to real audio without changing routing.

Timeline cutting uses a pointer overlay with a visible tool icon and exact-position guide; update pointer visuals through DOM refs to avoid rapid React/audio updates and keep clip drag handles from intercepting cuts.

Studio View keeps base furnishings independent of project tracks, derives instruments/microphones and racks from tracks/inserts, opens existing editors, and reads real levels through one 20 fps DOM timer; no duplicate project/audio state keeps it synchronized.

Note-channel razor/split unrolls looping patterns to song length and stores cut regions (track.cuts/activeRegion via lib/synclab/note-cuts); track-menu clicks bubble through portals, so row/header handlers ignore targets outside currentTarget to avoid opening the piano roll.
Arrangement clip presentation consumes per-lane track color variables with shared semantic fill/ink/selection tokens; MIDI cut regions draw separate bounded blocks without changing note playback or cut state.
AI stem separation runs Demucs on Replicate via server functions (start/poll/fetch); the browser polls so no server call waits on the model, and on-device spectral separation stays as the free fallback.

Mixer uses named shared row classes for compact desktop geometry, a store-backed channel list and an output dock; phone strips retain touch-sized controls and existing routing/actions. Channel EQ knobs and curve share track plugin parameters, creating an insert on first adjustment so untouched channels retain their signal path. The desktop mixer gets extra editor height and excludes DeviceBar so names and faders stay visible. The top of every channel is the name plate (instrument icon, bold name, small clip LED dot) above one clean header row; keep both large enough to read on desktop and touch consoles.
Desktop mixer strips share explicit grid rows across track, bus, VCA, aux and master so gain headers and bottom icons cannot drift when optional rows are absent. Bus/VCA/aux header gain uses its existing level control; track/master trim retains its dedicated setting.
Desktop Drum Machine uses the shared DrumRoll in a dedicated view and excludes the bottom DeviceBar to fit every default sound row; pads, sound and kit controls remain available through tabs. Phone retains its touch editing geometry.

Mixer selection retains its panel with portal-safe clicks and labeled channel-name buttons. Shared sliders forward labels to focusable thumbs; toolbar shortcuts reuse store actions.
Timeline header width uses one inherited variable for ruler, song, folders, automation and lanes; height drags preview in the DOM and commit once to avoid audio churn. Phone arrangement and mixer reuse desktop controls with native scrolling.
Touch mixer styling is scoped by data-touch-console; keep desktop strips and audio routing shared while sizing phone targets independently.
Phone studio always opens on the edit screen: entering the studio or resuming the page closes any tool panel, so an instrument like the drum machine never greets the user first.
Studio View back side (StudioBack.tsx) mirrors the real signal path — track → inserts → mixer channel → master → monitors/reel plus bus sends; re-patching a cable performs the matching store action (insert reorder, bypass, send level), never a visual-only change.

Studio rear devices use category columns inside one scrollable measured canvas; keep the cable SVG and jack positions in that same coordinate space so horizontal and vertical scrolling preserve connections.
Drum-channel razor/split unrolls pad steps to song length and reuses track.cuts/activeRegion; deleting a part zeroes those steps. Generate Stem isolates the chosen part with Demucs (lib/synclab/ai-isolate) and falls back to on-device cleaning when the AI service fails.

Timeline recording drags use pointer-based new-channel drop bounds and edge scrolling; transfer single clips atomically through track-move so sibling takes stay put and covered source notes/hits clear.
WaveformView collapses to its intrinsic 16px inside a <button> (pad grids, chop tiles); give it `className="!h-full !w-full"` there, as VideoSampler chop tiles and PadSampler pad strips do.

Pad Sampler saves source-relative chop ranges; bank transforms preserve the source and require replacement confirmation. Pitch-preserving pad stretch runs shared WSOLA offline in a worker and retains pad shaping and manual-save semantics.

Device-conditional UI reads `useIsAppleMobile()` (`src/hooks/use-is-apple-mobile.ts`), never `isAppleMobile()` inside a render body — the server and an iPad would disagree and hydration breaks; `outputRoutingHint(apple)` takes the flag for the same reason. `canPickOutput` stays a pure browser-capability check: iPadOS reports `setSinkId` as available yet every call rejects, so the Output picker is suppressed by the Apple flag and `setOutputDevice` refuses with the Control Centre hint.
