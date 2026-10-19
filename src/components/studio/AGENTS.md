# Studio components

TouchSynth is a 5-lane loop station (drums, bass, poly, melody, stabs/arp from TOUCH_LANES) in shared synth tabs; gated notes use previewNote once per note, drums lane uses engine.playDrum, pointer movement updates patch parameters at 20 fps, and lane/scale/key/rate/gate plus recorded lane loops persist in patch.touch. Loop playback uses one interval timer with a DOM playhead, and Send to timeline flattens loops via loopsToNotes into track notes at the playhead without duplicate capture or audio engines. Desktop and phone shortcuts select/reuse a dedicated Touch Synth track whose editor initially opens the performance tab.

Hardware presentation uses shared Knob parts and CSS device tokens scoped by synth style/effect kind; indicators remain parameter/signal-driven and skins stay on the surround to preserve customization without simulated audio or duplicate controls.

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

Mixer selection retains its panel with portal-safe clicks and labeled channel-name buttons. Shared sliders forward labels to focusable thumbs; toolbar shortcuts reuse store actions.
Timeline header width uses one inherited variable for ruler, song, folders, automation and lanes; height drags preview in the DOM and commit once to avoid audio churn. Phone arrangement and mixer reuse desktop controls with native scrolling.
Touch mixer styling is scoped by data-touch-console; keep desktop strips and audio routing shared while sizing phone targets independently.
Phone studio always opens on the edit screen: entering the studio or resuming the page closes any tool panel, so an instrument like the drum machine never greets the user first.
Studio View back side (StudioBack.tsx) mirrors the real signal path — track → inserts → mixer channel → master → monitors/reel plus bus sends; re-patching a cable performs the matching store action (insert reorder, bypass, send level), never a visual-only change.

Studio rear devices use category columns inside one scrollable measured canvas; keep the cable SVG and jack positions in that same coordinate space so horizontal and vertical scrolling preserve connections.
Drum-channel razor/split unrolls pad steps to song length and reuses track.cuts/activeRegion; deleting a part zeroes those steps. Generate Stem isolates the chosen part with Demucs (lib/synclab/ai-isolate) and falls back to on-device cleaning when the AI service fails.
