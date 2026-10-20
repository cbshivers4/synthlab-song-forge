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
Meter/looper visuals share 20 fps timers; keep rapid React updates off audio paths.
Mixer VCAs scale assigned channel gains without changing individual faders, while aux returns control post-effect levels before the master; this avoids routing returns back into their own sends.
Mixer meters tap real bus/return/VCA signals; master scales the mix and subgroups scale pre-bus sends.
MIDI: stable IDs, one hot-plug-safe multi-input subscription. Read nested AGENTS.md.
Timebase helpers use transport.beatsPerBar, synced each render, so all bar math agrees.
Timeline/razor share timelineUsesWaveform; exact cuts and portal menus stay in arrangement. Drags hit-test lanes/new-channel bounds with edge scrolling; atomic clip moves clear source notes/hits.
Bus/send insert edits crossfade parallel paths after the bus scope/send output; never disconnect active sources on parameter edits, which cuts live sound and bypasses effects.
Printed instrument and drum takes replace overlapping clips by default; only explicit overdub stacks them, so ordinary re-recording does not double playback.
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
Drum snap is session-only for new step writes, never existing hits.
MP3/MP4 imports/exports retain originals in the private library with content hashes to avoid duplicates; saved videos open Video Sampler.
Cloud deletion reads raw sessions, confirms deletion, then cleans owned files; missing assets cannot block removal.
Reel recorder: singleton worklet; playback bypasses master. Meters use post-master taps; exit releases input, keeps tape. Shared winding math uses capture duration and conserved tape area to match song length.

Video cuts use source seconds/grid/clamp; kits save MIDI notes. Keyboard/learned MIDI share pad triggers; MIDI consumers prevent doubled track notes.


Device prefs use cache/events, not autosave/tick storage. Diagnostics preserve audio; unsupported controls stay read-only.

Recording-region helpers bound edits; patternRegion bounds drums. Captured notes are absolute.
Touch genre loops are pure MIDI compositions in touch-loop-library; load through patch.touch so editing and playback share state.
Project exits use AppProvider/ProjectCloseGuard on both layouts: compare musical snapshots and await recording before save-and-close to preserve manual saving.
Shortcuts share studio actions and yield to controls/claimed keys to avoid doubling.
Bulk drums use atomic store transforms preserving empty steps, loop bounds and hit metadata; shared controls prevent divergent editors.
Sound screens use shared tokens and real parameter drag points with 20 fps signal drawing, never fake wave activity.
