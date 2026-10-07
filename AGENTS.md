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

Live Looper and Live View are separate studio panels; the singleton audio looper stays active between panel switches so recorded loops are not interrupted.
Live Looper playback uses a direct monitor bus outside the song master; otherwise app-output recording re-captures playing loops and creates feedback. Send loops to the timeline for project export and master processing.
Meter and looper visuals refresh at 20 fps from shared timers; keep high-frequency React updates off the audio path to reduce recording and playback stutters.
Phone settings open Phone features from More and the beat maker; Bluetooth shortcuts open Audio explicitly, keeping both accessible.
Mixer VCAs scale assigned channel gains without changing individual faders, while aux returns control post-effect levels before the master; this avoids routing returns back into their own sends.
Mixer meters read analyser taps from the actual bus, aux return, and VCA member signals; master gain controls the summed mix, while subgroup changes also scale their tracks' pre-bus sends.
The timeline overview scrolls one fixed-width arrangement; synchronize its ruler and song-part header with track scrolling while pinning header controls, so bar positions stay aligned at every zoom and viewport width.
MIDI Learn stores CC-to-target mappings by stable track/device IDs and applies incoming values through existing state or the singleton looper; only expose Learn on controls with a real implemented dispatch path.
Ableton Live interoperability uses user-exported audio stems and standard MIDI files, not embedded Ableton software or proprietary project decoding; this keeps the handoff functional without misrepresenting native integration.
- Time signature is transport.beatsPerBar over a quarter-note beat; bar math goes through timebase helpers (stepsPerBar/getBeatsPerBar), synced by the store each render, so ruler, metronome, count-ins and looper agree.
Bus and send insert changes crossfade parallel audio paths after the bus scope or send output; never disconnect the active source on each parameter edit, because that cuts live sound and bypasses the actual effect chain.
Printed instrument and drum takes replace overlapping clips by default; only explicit overdub stacks them, so ordinary re-recording does not double playback.
- Computer typing keys (src/lib/synclab/qwerty.ts) play the armed/selected instrument via previewNote, which both sounds and captures notes; keep it the single note path so recording stays consistent.
Detached studio panels use a synchronous user-click window.open and React portal to preserve shared audio/state; desktop child windows need a draggable header for moving between monitors without reloading the studio.
Bottom device displays read post-device or track analyser taps at 20 fps; never substitute animated decoration for live signal.
- The post-login menu presents cloud projects, device recents, saved templates, and starter templates in one responsive workspace; retain their existing storage and open actions when changing its layout.
- Every security-definer helper used inside an RLS policy (e.g. public.has_role) must be explicitly GRANTed EXECUTE to anon/authenticated/service_role; Supabase does not grant function EXECUTE by default, and a missing grant makes the policy error out so reads silently return empty results instead of rows.
Studio panel wallpaper uses one bundled JPEG with a dark semantic overlay and per-panel skin overrides; this keeps controls legible while letting users customize each panel without external image dependencies.
Timeline track names share one compact row with header controls; put the track-kind label beside the input selector to prevent it spilling into the arrangement.
The arrangement playhead is scoped to the rendered track-row wrapper, never the empty workspace, so it stops after the last visible track.
Synth sections share wrapping tabs; X-Y pads dispatch through updatePatch to stay synchronized with knobs and saved presets without removing controls.
Editors shrink below saved height to preserve the timeline minimum and avoid toolbar clipping.
Drum artwork uses semantic inline SVG within unchanged pads to preserve controls and audio.

Drum pattern selection and the scrollable step sequencer precede the pad sound surface so tall sound controls cannot bury pattern editing; retain the pad layout unchanged.
Embedded keyboards reuse Keyboard with a track or sample callback and shared typing toggle; claim events once and yield pad shortcuts to prevent doubled notes.
Paste content at the playhead onto the selected or explicit channel, preserving its settings; Duplicate track separately clones channels.
Synth/MIDI selection opens piano roll; explicit instrument actions open synth. Sampler editors show Sampler with Stretch before chops.
Transport glass tokens and named groups stay scoped; phone menus reuse existing handlers to preserve audio behavior.
Phone mixer essentials reuse track/bus actions; full strips remain in dialogs. Drum-roll step pages keep touch cells large without changing patterns.
