# Shared audio logic

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
