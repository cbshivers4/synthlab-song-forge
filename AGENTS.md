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

Live Looper and Live View stay separate; singleton loops survive switching.
Looper playback bypasses the song master to avoid recapture feedback; send loops to the timeline for export/master processing.
Meter and looper visuals refresh at 20 fps from shared timers; keep high-frequency React updates off the audio path to reduce recording and playback stutters.
Phone settings open Phone features from More and the beat maker; Bluetooth shortcuts open Audio explicitly, keeping both accessible.
Mixer VCAs scale assigned channel gains without changing individual faders, while aux returns control post-effect levels before the master; this avoids routing returns back into their own sends.
Mixer meters read analyser taps from the actual bus, aux return, and VCA member signals; master gain controls the summed mix, while subgroup changes also scale their tracks' pre-bus sends.
Timeline overview, ruler and song lane share arrangement width and scrolling; pin header controls to align bars.
MIDI Learn uses stable track/device IDs; expose only implemented dispatch paths.
Ableton handoff uses stems and standard MIDI, never proprietary decoding.
- Time signature is transport.beatsPerBar over a quarter-note beat; bar math goes through timebase helpers (stepsPerBar/getBeatsPerBar), synced by the store each render, so ruler, metronome, count-ins and looper agree.
Bus and send insert changes crossfade parallel audio paths after the bus scope or send output; never disconnect the active source on each parameter edit, because that cuts live sound and bypasses the actual effect chain.
Printed instrument and drum takes replace overlapping clips by default; only explicit overdub stacks them, so ordinary re-recording does not double playback.
- Computer typing keys (src/lib/synclab/qwerty.ts) play the armed/selected instrument via previewNote, which both sounds and captures notes; keep it the single note path so recording stays consistent.
Detached studio panels use a synchronous user-click window.open and React portal to preserve shared audio/state; desktop child windows need a draggable header for moving between monitors without reloading the studio.
Bottom device displays read post-device or track analyser taps at 20 fps; never substitute animated decoration for live signal.
- The post-login menu presents cloud projects, device recents, saved templates, and starter templates in one responsive workspace; retain their existing storage and open actions when changing its layout.
- GRANT EXECUTE on RLS security-definer helpers to anon/authenticated/service_role; missing grants break policy reads.
Studio panel wallpaper uses one bundled JPEG with a dark semantic overlay and per-panel skin overrides; this keeps controls legible while letting users customize each panel without external image dependencies.
Timeline names stay single-line; phone actions prioritize REC/AUTO with isolated menu clicks to avoid opening instruments.
Playhead stays within track rows; headers, ruler and song lane share its width variable, including large phone controls, to avoid covering buttons.
Synth sections share wrapping tabs; X-Y pads dispatch through updatePatch to stay synchronized with knobs and saved presets without removing controls.
Editors shrink below saved height to preserve the timeline minimum and avoid toolbar clipping.
Drum artwork uses semantic SVG; sort display copies and bank slices by stable IDs/indices to preserve audio and MIDI.

Phone drum tabs reuse DrumRoll and instrument pads for edits/tap recording; sound/kit tabs preserve controls without duplication.
Keyboards reuse Keyboard and one note path; independent skin slots color opaque keys and wallpaper only the surround, preventing doubled notes.
Paste content at the playhead onto the selected or explicit channel, preserving its settings; Duplicate track separately clones channels.
Synth selection opens piano roll; explicit actions open synth. Pin sampler waveform above Stretch/chops to keep cuts visible; PCM slices use previewNote for gate/choke.
Transport: desktop wraps; phone uses shallow scrolling rows to preserve timeline height, shared Loop/rhythm setters, wide meters and a tools menu.
Phone shares audio/state with desktop; render all channels, tracks and creative tools in both phone menus with native scrolling, never an unpaged slice that hides entries.
Drum snap is session-only and affects step writes, not existing hits, preserving patterns.
Count-in haptics use the shared beat timer and guarded vibration support, independent of audio.
MP3/MP4 imports/exports retain originals in the private library with content hashes to avoid duplicates; saved videos open Video Sampler.
Cloud deletion reads raw sessions, confirms row deletion, then cleans owned project files; missing playback assets cannot block removal.
Reel recorder: singleton AudioWorklet capture; tape bypasses master to avoid feedback. Timeline meters read live post-master taps without input activation; exit releases input, retaining tape.

Video Sampler pins wave+stretch; video seconds anchor cuts; stretch sets playbackRate, WSOLA-prints chops.
