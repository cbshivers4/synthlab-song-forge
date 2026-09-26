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
The timeline overview scrolls one fixed-width arrangement; synchronize its ruler and song-part header with track scrolling while pinning header controls, so bar positions stay aligned at every zoom and viewport width.
MIDI Learn stores CC-to-target mappings by stable track/device IDs and applies incoming values through existing state or the singleton looper; only expose Learn on controls with a real implemented dispatch path.
