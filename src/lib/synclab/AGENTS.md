# Shared audio logic

Vintage drum PCM is deterministic, original synthesis cached by kit/kind/decay/sample rate in the existing playDrum path, so live playback and offline rendering share voices and pad shaping. Factory kit loading clears sample overrides while preserving pad IDs, MIDI mappings and patterns.