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
Meter/looper visuals share 20 fps timers; keep rapid React updates off audio paths to prevent stutters.
Phone settings open Phone features from More and the beat maker; Bluetooth shortcuts open Audio explicitly, keeping both accessible.
Mixer VCAs scale assigned channel gains without changing individual faders, while aux returns control post-effect levels before the master; this avoids routing returns back into their own sends.
Mixer meters read analyser taps from the actual bus, aux return, and VCA member signals; master gain controls the summed mix, while subgroup changes also scale their tracks' pre-bus sends.
MIDI Learn uses stable track/device IDs; expose only implemented dispatch paths.
Ableton handoff uses stems and standard MIDI, never proprietary decoding.
- Time signature is transport.beatsPerBar over a quarter-note beat; bar math goes through timebase helpers (stepsPerBar/getBeatsPerBar), synced by the store each render, so ruler, metronome, count-ins and looper agree.
Bus and send insert changes crossfade parallel audio paths after the bus scope or send output; never disconnect the active source on each parameter edit, because that cuts live sound and bypasses the actual effect chain.
Printed instrument and drum takes replace overlapping clips by default; only explicit overdub stacks them, so ordinary re-recording does not double playback.
- Computer typing keys (src/lib/synclab/qwerty.ts) play the armed/selected instrument via previewNote, which both sounds and captures notes; keep it the single note path so recording stays consistent.
Detached panels use synchronous user-click window.open + React portals for shared audio/state; child windows need draggable headers for monitor moves without reloads.
Bottom displays read live analyser taps at 20 fps. Generator waves use PCM/offline voices, never decoration; stem masks run in a worker for smooth playback.
Post-login workspace retains cloud projects, device recents, saved/starter templates and their storage/open actions.
- GRANT EXECUTE on RLS security-definer helpers to anon/authenticated/service_role; missing grants break policy reads.
Studio panel wallpaper uses one bundled JPEG with a dark semantic overlay and per-panel skin overrides; this keeps controls legible while letting users customize each panel without external image dependencies.
Timeline names stay single-line; phone actions prioritize REC/AUTO with isolated menu clicks to avoid opening instruments.
Playhead stays within track rows; headers, ruler and song lane share its width variable, including large phone controls. It renders through the --playhead token (white, never dimmed) and stays draggable from ruler and track lanes.
Synth sections share wrapping tabs; X-Y pads dispatch through updatePatch to stay synchronized with knobs and saved presets without removing controls.
Read studio AGENTS.md before editor/mixer edits.
Drum artwork uses semantic SVG; sort display copies and bank slices by stable IDs/indices to preserve audio and MIDI.

Phone drum tabs reuse DrumRoll and instrument pads for edits/tap recording; sound/kit tabs preserve controls without duplication.
Keyboards reuse Keyboard and one note path; independent skin slots color opaque keys and wallpaper only the surround, preventing doubled notes.
Paste content at the playhead onto the selected or explicit channel, preserving its settings; Duplicate track separately clones channels.
Synth selection opens piano roll. Pin sampler waveform above Stretch/chops to keep cuts visible; PCM slices use previewNote for gate/choke.
Transport stays mounted: phone overlay and timeline use separate layout/paint containment with shared resize visibility; desktop transport stays below the workspace.
Phone shares desktop audio/state with native scrolling for all tracks/tools. AppProvider scopes phone tokens to the document via shared mobile detection so entry screens/portals match; desktop preferences stay separate.
Drum snap is session-only for new step writes, never existing hits.
Count-in haptics use the shared beat timer and guarded vibration, independent of audio.
MP3/MP4 imports/exports retain originals in the private library with content hashes to avoid duplicates; saved videos open Video Sampler.
Cloud deletion reads raw sessions, confirms deletion, then cleans owned files; missing assets cannot block removal.
Reel recorder: singleton AudioWorklet capture; tape bypasses master to avoid feedback. Timeline meters read live post-master taps without input activation; exit releases input, retaining tape.

Video cuts use source seconds/grid/clamp; kits save MIDI notes. Keyboard/learned MIDI share pad triggers; MIDI consumers prevent doubled track notes.


Device prefs use cache/events, never autosave/tick storage. Diagnostics snapshot prefs only, preserve audio and reuse panels; unsupported controls stay read-only.

Recording-region helpers bound edits; drum patternRegion aligns playback/display. Live captured notes get absolute bounds to prevent repeated visuals.
