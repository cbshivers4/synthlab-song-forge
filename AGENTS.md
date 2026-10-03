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
Phone settings open to Phone features and remain reachable from More and the full-screen beat maker; this keeps accessibility controls available without menu hunting.
Mixer VCAs scale assigned channel gains without changing individual faders, while aux returns control post-effect levels before the master; this avoids routing returns back into their own sends.
Mixer meters read analyser taps from the actual bus, aux return, and VCA member signals; master gain controls the summed mix, while subgroup changes also scale their tracks' pre-bus sends.
The timeline overview scrolls one fixed-width arrangement; synchronize its ruler and song-part header with track scrolling while pinning header controls, so bar positions stay aligned at every zoom and viewport width.
MIDI Learn stores CC-to-target mappings by stable track/device IDs and applies incoming values through existing state or the singleton looper; only expose Learn on controls with a real implemented dispatch path.
Ableton Live interoperability uses user-exported audio stems and standard MIDI files, not embedded Ableton software or proprietary project decoding; this keeps the handoff functional without misrepresenting native integration.
- Time signature is transport.beatsPerBar over a quarter-note beat; bar math goes through timebase helpers (stepsPerBar/getBeatsPerBar), synced by the store each render, so ruler, metronome, count-ins and looper agree.
Bus and send insert changes crossfade parallel audio paths after the bus scope or send output; never disconnect the active source on each parameter edit, because that cuts live sound and bypasses the actual effect chain.
Printed instrument and drum takes replace overlapping clips by default; only explicit overdub stacks them, so ordinary re-recording does not double playback.
- Computer typing keys (src/lib/synclab/qwerty.ts) play the armed/selected instrument via previewNote, which both sounds and captures notes; keep it the single note path so recording stays consistent.
