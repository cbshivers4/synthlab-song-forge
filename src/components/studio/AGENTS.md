# Studio components

SynthEditor derives instrument tabs from timeline track IDs and selects through the shared store; keep each track's editor keyed by its ID so switching preserves project patches without leaking local controls between synths.

Effects Rack reuses track plugin instances and store actions with inline RackEffect modules; post-insert analyser scopes and shared 20 fps meter callbacks keep the rack tied to real audio without changing routing.

Timeline cutting uses a pointer overlay with a visible tool icon and exact-position guide; update pointer visuals through DOM refs to avoid rapid React/audio updates and keep clip drag handles from intercepting cuts.

Studio View keeps base furnishings independent of project tracks, derives instruments/microphones and racks from tracks/inserts, opens existing editors, and reads real levels through one 20 fps DOM timer; no duplicate project/audio state keeps it synchronized.

Note-channel razor/split unrolls looping patterns to song length and stores cut regions (track.cuts/activeRegion via lib/synclab/note-cuts); track-menu clicks bubble through portals, so row/header handlers ignore targets outside currentTarget to avoid opening the piano roll.
Arrangement clip presentation consumes per-lane track color variables with shared semantic fill/ink/selection tokens; MIDI cut regions draw separate bounded blocks without changing note playback or cut state.
AI stem separation runs Demucs on Replicate via server functions (start/poll/fetch); the browser polls so no server call waits on the model, and on-device spectral separation stays as the free fallback.

Mixer uses named shared row classes for compact desktop geometry, a store-backed channel list and an output dock; phone strips retain touch-sized controls and existing routing/actions. The desktop mixer gets extra editor height and excludes DeviceBar so names and faders stay visible.

Mixer selection retains its panel with portal-safe clicks and labeled channel-name buttons. Shared sliders forward labels to focusable thumbs; toolbar shortcuts reuse store actions.
Timeline header width uses one inherited variable for ruler, song, folders, automation and lanes; height drags preview in the DOM and commit once to avoid audio churn. Phone arrangement and mixer reuse desktop controls with native scrolling.
Touch mixer styling is scoped by data-touch-console; keep desktop strips and audio routing shared while sizing phone targets independently.
Phone studio always opens on the edit screen: entering the studio or resuming the page closes any tool panel, so an instrument like the drum machine never greets the user first.
Studio View back side (StudioBack.tsx) mirrors the real signal path — track → inserts → mixer channel → master → monitors/reel plus bus sends; re-patching a cable performs the matching store action (insert reorder, bypass, send level), never a visual-only change.
