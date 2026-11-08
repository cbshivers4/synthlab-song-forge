# Shared audio logic

Effect menu catalogs use availableEffects to merge current factory definitions with installed custom definitions without modifying saved sessions or active insert parameters; old projects must not hide newer hardware.

Audio Converter decodes local files in a disposable context and reuses shared PCM/MP3 encoders; device-only formats use a silent isolated recorder with cancellation/cleanup and honest capability checks, never the studio transport or project mutations.

Timeline mono/stereo file actions render selected clip trims/rates/fades or the loaded sampler source offline, then encode an explicit one- or two-channel WAV; never replace source material or alter live routing/tempo during conversion.

Built-in synth chorus and reverb use separate per-channel destination scales; update both for fader/automation/mute/VCA and disconnect both on removal, so effects stay independent without bypassing mix controls.

Recording Stop paths share a deduplicated finalizer that awaits pending input starts before landing takes; preserve the stop position until notes finish, then rewind. Arrangement paste uses material helpers on the selected channel, and right-edge extension renders pitch-preserving audio through the existing stretch path rather than referencing beyond source bounds.

Audio entry points unlock phone media in the triggering gesture using valid silent PCM and resume suspended/interrupted contexts; first drum taps restore cached mixer routing/inserts when their channel is absent, so Stop and cold starts cannot leave default routing.
Sample, clip and drum playback share playbackChannel to restore cached mixer routing and inserts after Stop retires a channel; existing channels retain the fast path without rebuilding active audio.
Immutable musical edits retain rack references; channel-scoped input caches skip unchanged inserts/mixer writes, while solo/VCA/routing changes and recreated channels invalidate mixer inputs. Step-only drum edits never rewrite held-voice sound parameters, preserving envelopes during playback.

Drum-pad deletion updates both active pads and the active bank snapshot via the shared bank helper; other banks and library assets remain untouched so recalling a bank cannot resurrect deleted pads.

Vintage drum PCM is deterministic, original synthesis cached by kit/kind/decay/sample rate in the existing playDrum path, so live playback and offline rendering share voices and pad shaping. Factory kit loading clears sample overrides while preserving pad IDs, MIDI mappings and patterns.

Live sound edits use engine-owned, expiring voice handles through syncSoundControls; update existing nodes without retriggering/capture so held notes respond without doubled recording. Structural voice changes apply to subsequent notes; safe rack parameters update in place to retain modulation phase and tails.- Effect insert node counts in linkInsertChain size map must match nodes pushed per kind (first = input, last = output); new effect params need a live setter and appear in old projects via withDefaultParams.
- Latency: heardStepPos subtracts outputDelay(ctx); mic takes use alignedTake with the device-local input offset (latency.ts); live notes call syncMixIfChanged so per-note work stays minimal.

Interface takes recorded on one side only (left-only or right-only stereo) are centred when decoded into sampleBuffers via centerOneSided, so samples/clips play from both speakers; real stereo is untouched.
Creative hardware effects (creative-fx.ts) each build their own real signal path between one input and one output node (insert size 2), with their own params, 10 recipes and CSS skin; stereo matrices must upmix mono before splitting.

Scheduler: the frame loop calls reachStep for every heard step in order (never only the latest), so punch markers, automation writes and recorded mute presses survive stalls.
Count-in clicks are scheduled on the AudioContext clock just ahead of time (cancellable); the visible countdown follows the audio clock, not a beat-length interval.
Fader/pan/send moves touch their automation lane through updateTrack (automation-write.ts helpers); Write/Touch/Latch record at the heard step and Latch/Touch read back when not recording.
scheduleStep (schedule-step.ts) is the single per-step note/drum/clip scheduler for live playback and the offline song render (song-render.ts), so exports play exactly what you hear; live-only take bookkeeping is passed in via ScheduleLive.
Offline renders build the engine graph with buildGraph() on an OfflineAudioContext and reuse the live engine's decoded AudioBuffers; the live performance insert (live-fx) is not part of exports.
During playback the moving step lives in playhead.ts (external store), not in React transport state: displays use usePlayStep() in small leaf components, handlers read getPlayStep(), and every transport update goes through the store's setTransportState wrapper so state and playhead stay in sync. Never put the per-step position back into context state — it re-renders the whole studio every 16th note.
Loop recording on microphone tracks never stops between passes: one continuous recording is cut into per-pass takes (loop-takes.ts) when you stop, so no audio is lost at the loop start; instrument/drum takes still stop at the loop end.
Native plugin inserts (native-insert.ts): PluginInstance.native marks a real desktop plugin; the engine never imitates it with a built-in effect — it passes audio through until the native host is attached. The ring-buffer layout documented there is the contract the C++ host must match; the worklet source is generated from the same NativeInsertCore class, which must stay self-contained (no outside references, no helper-requiring syntax).
Song clock (song-clock.ts) is the scheduler's latest step + audio time; outside tools (Live Looper) read it to start on song bar lines instead of keeping their own transport.
MIDI clock (midi-clock.ts): pulses are sent from the song scheduler per scheduled step (6 per 16th, timestamped via getOutputTimestamp), Start/Continue/Stop follow transport.playing; incoming realtime bytes are split off in the shared MIDI subscription before note/CC handling and only act when Follow is on.
Input loss/changes go through mic.ts window events (input-lost / input-changed / input-fallback); the store stops a take on loss (keeping what was recorded) and reopens the armed input, so no tool silently records from a different device.
Reel rotation is derived from tape position via reelAngles (turns = (radius − hub)/thickness), never a looping CSS spin.
Undo commits a pending (debounced) history step before stepping back, so Undo straight after an edit undoes exactly that edit.
Sampler reverse reads the mirrored window (sampleWindow) of the reversed buffer so the trimmed part plays backwards in live playback and renders alike; Normalize sets level from samplePeak over the trimmed part (max 200%), never rewriting audio.
Note repeat (note-repeat.ts) schedules held-pad hits on the audio clock, aligned to the song grid via the song clock while playing; recorded rolls accumulate into one local step array per hold so fast hits don't overwrite each other.
Drum pad HOLD (pad.sustain, 0..1 s) extends the full-level stage before release; unset = 0 keeps old projects sounding the same.
Drum pattern chains (drum-chain.ts, track.drumChain) are resolved per step inside scheduleStep, so live playback and export agree: the on-screen pattern plays its live pads, other slots play their saved bank snapshots, unused slots are silent. Taps/recording still write into the pattern on screen.

Bulk drums use atomic store transforms preserving empty steps, loop bounds and hit metadata; shared controls prevent divergent editors.
Mute/solo presses record as per-track switch events in the scheduler's reachStep during timeline or tape takes (replace semantics) and replay only at recorded presses; a hand press outside a take clears that button's recorded presses (manualSwitchPatch in updateTrack/MIDI paths) so a manual mute always stays.
MIDI export (midi-export.ts) collects notes by running scheduleStep against a note-collecting stand-in engine, so .mid files match playback; stems/one-track exports re-render through renderSong with only that track soloed.
Cloud saves store sampler, clip and pad-sampler audio as the project's own copy (ownedMediaPlan), like drum pads, so duplicates survive deletion of the original.
Mix faders store linear gain (0–2) but move on the shared dB taper in fader-taper.ts (0 dB near 80% throw, +6 dB at the top); every fader, volume slider and MIDI CC volume converts through faderGain/faderPosition so screen, controllers and automation agree.
Touch Synth drum lane keeps legacy loop indices (kick 0, snare 1, hat 2, clap 3, tom 4) and appends new sounds (openhat 5) so saved loops and MIDI exports keep their pitches; the pad maps four sound columns via touchDrumAt.
canvasRect maps the live getBoundingClientRect through the same rotation as canvasPoint (rotateSidewaysRect), never offsetTop sums, so taps inside scrolled panels on the sideways phone land where the finger is.
Level meters (engine peakOf) read a separate long-window peak analyser per meter node sized by meterWindowSize to cover the 20 fps poll gap; short drum transients otherwise fall between reads. Scope analysers keep their own short windows.
Live Looper slot count and names are device prefs (localStorage, like loop colors) while loop audio stays session-only; slots can be added/removed (gains/sources spliced with slots and reindexed), MIDI pads address the first 8.
