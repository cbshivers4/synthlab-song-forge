# Shared audio logic

Drum-pad deletion updates both active pads and the active bank snapshot via the shared bank helper; other banks and library assets remain untouched so recalling a bank cannot resurrect deleted pads.

Vintage drum PCM is deterministic, original synthesis cached by kit/kind/decay/sample rate in the existing playDrum path, so live playback and offline rendering share voices and pad shaping. Factory kit loading clears sample overrides while preserving pad IDs, MIDI mappings and patterns.

Live sound edits use engine-owned, expiring voice handles through syncSoundControls; update existing nodes without retriggering/capture so held notes respond without doubled recording. Structural voice changes apply to subsequent notes; safe rack parameters update in place to retain modulation phase and tails.- Effect insert node counts in linkInsertChain size map must match nodes pushed per kind (first = input, last = output); new effect params need a live setter and appear in old projects via withDefaultParams.
