Drum pads fill five equal columns (`.drum-pad-grid` uses `repeat(5, minmax(0,1fr))`) and each cell stays exactly square through `aspect-ratio: 1/1` on the cell, so pads grow with the panel without ever clipping the sound-controls column; the sideways-phone grid keeps a fixed square variable (`--drum-pad-size`) with matching `grid-auto-rows` so its strip can scroll horizontally, and sampler pads keep sizing from `--sampler-pad-size`. Keep pad markup free of fixed/min heights so drum and sample pads always read as true squares on desktop and sideways phone.

Every mixer channel and the master strip carry a pre-fader GAIN knob (Track.gain / BusState.gain, 0–2, default 1) driving a dedicated trim GainNode between channel input and fader in the audio engine — never fold trim into the fader gain, or automation and VCA math break. MIDI learn accepts CC (knobs/faders) and note buttons (key `n:channel:pitch`, toggles mute/solo/arm on press only); mapped buttons must never play instrument notes. Meter ladders and VU faces keep a printed red/amber overload zone (unlit tinted segments, `vu-hot-band`) so the clipping region reads as hardware artwork, not a flat recolour.

# Studio components

Sampler and Pad Sampler share WaveformZoom for inspection-only zoom/scroll and decoded detail; chop/trim coordinates use the visible expanded waveform rectangle, including sideways phones, without changing source audio or stretch settings.
Sampler whole-sample preview is click/keyboard activated and never captures notes; stretch preview unlocks Web Audio synchronously before rendering and releases its loop source on Stop/unmount, avoiding delayed media autoplay restrictions.

Phone channel/project naming shares a screen-aligned NameEditDialog counter-rotated inside the body portal and measured by VisualViewport, keeping native keyboard typing visible without rotating the studio. Recording position derives from the shared transport and phone recording follows the timeline without changing playback.

Timeline selection exposes shared track actions; synth taps open the piano roll while empty-lane taps with copied material offer a snapped destination independently of the playhead. Portal events and drag movement must not trigger editor selection.

PianoRoll owns focused note shortcuts and a session-only note clipboard; single-tap Draw, Select and Erase modes use loop-bounded helpers. Coordinate mapping derives visible canvas bounds so native phone scrolling does not displace note edits; deletion only removes explicit selections.
PianoRoll keeps horizontal navigation above the grid and a shared-width draggable ruler for its placement cursor; stopped ruler seeks use the existing transport, while playback/recording placement never interrupts audio.
Track selection menus remain in the mounted piano editor for synths; existing-note clicks open anchored actions only after a stationary selection, preserving drag and multi-select. Loop button highlighting follows transport.loop rather than matching selected-part bounds.

EQ and Pro EQ share EqGrid and scoped eq-workstation/eq-chart tokens for their frequency-display presentation; keep response paths parameter-derived and analyser drawing at 20 fps, without changing DSP or adding simulated spectra.

TouchSynth keeps five lanes in patch.touch and uses shared previewNote/playDrum, one loop timer and a DOM playhead. Force poly preview voices so lanes overlap; align overdubs with that loop clock. Grid edits use placeLoopNote/eraseLoopNote to retain other notes; patch/lane changes preserve touch settings. Send to timeline reuses loopsToNotes without capture or extra engines. Desktop/phone shortcuts reuse a dedicated track and open its performance tab.

Hardware presentation uses shared Knob parts and CSS device tokens scoped by synth style/effect kind; indicators remain parameter/signal-driven and skins stay on the surround to preserve customization without simulated audio or duplicate controls.
Rack and compact effect modules share data-fx-skin tokens and data-fx-variant for same-kind devices; RackEffect parameter windows read existing plugin values, and distinct deck layouts/knob finishes remain presentation-only.
Drum artwork uses semantic SVG; sort copies and banks by stable IDs so pad identity stays consistent.

WorkflowBar reuses shared recording, clipboard, take and routing actions; only explicit active clips/regions are part targets, so deleting a part never removes its channel. Keep the bar shared by phone and desktop without duplicating transport state.
Timeline menus, part menus and shortcuts share deleteSelectedPart: expand repeating MIDI/drum material before bounded deletion so sibling bars survive; only explicit Delete track removes a channel. Mixer meter ticks and segments share the -48…+6 dB scale and raw-signal clip latch to avoid contradictory overload indicators.

Settings diagnostics snapshots only device preferences across explicit reloads; independent test capture is released and never takes shared studio mic ownership. Access checks never replace MIDI handlers or audio routing, so live work stays intact.
MIDI settings uses shared controller profiles and store input selection; illustrations distinguish available profiles from reported inputs, and category navigation remains alongside the panel to match the workstation reference without duplicate MIDI state.

SynthEditor derives instrument tabs from timeline track IDs and selects through the shared store; keep each track's editor keyed by its ID so switching preserves project patches without leaking local controls between synths.
Preset auditions pass the selected patch through previewNote with capture disabled, so immediate factory/user/modular previews never read a stale track patch or record test notes.
Preset selectors share PresetNavigator for previous/next cycling in menu order, invoking the same selection/audition callback as the menu; empty libraries disable arrows and browsing never saves projects.

Effects Rack reuses track plugin instances and store actions with inline RackEffect modules; post-insert analyser scopes and shared 20 fps meter callbacks keep the rack tied to real audio without changing routing.

Timeline cutting uses a pointer overlay with a visible tool icon and exact-position guide; update pointer visuals through DOM refs to avoid rapid React/audio updates and keep clip drag handles from intercepting cuts.

Studio View keeps base furnishings independent of project tracks, derives instruments/microphones and racks from tracks/inserts, opens existing editors, and reads real levels through one 20 fps DOM timer; no duplicate project/audio state keeps it synchronized.

Note-channel razor/split unrolls looping patterns to song length and stores cut regions (track.cuts/activeRegion via lib/synclab/note-cuts); track-menu clicks bubble through portals, so row/header handlers ignore targets outside currentTarget to avoid opening the piano roll.
Arrangement clip presentation consumes per-lane track color variables with shared semantic fill/ink/selection tokens; MIDI cut regions draw separate bounded blocks without changing note playback or cut state.
AI stem separation runs Demucs on Replicate via server functions (start/poll/fetch); the browser polls so no server call waits on the model, and on-device spectral separation stays as the free fallback.

Mixer uses named shared row classes for compact desktop geometry, a store-backed channel list and an output dock; phone strips retain touch-sized controls and existing routing/actions. Channel EQ knobs and curve share track plugin parameters, creating an insert on first adjustment so untouched channels retain their signal path. The desktop mixer gets extra editor height and excludes DeviceBar so names and faders stay visible. The top of every channel is the name plate (instrument icon, bold name, small clip LED dot) above one clean header row; keep both large enough to read on desktop and touch consoles.
Desktop mixer strips share explicit grid rows across track, bus, VCA, aux and master so gain headers and bottom icons cannot drift when optional rows are absent. Bus/VCA/aux header gain uses its existing level control; track/master trim retains its dedicated setting.
Desktop Drum Machine uses the shared DrumRoll in a dedicated view and excludes the bottom DeviceBar to fit every default sound row; pads, sound and kit controls remain available through tabs. Phone retains its touch editing geometry.

Mixer selection retains its panel with portal-safe clicks and labeled channel-name buttons. Shared sliders forward labels to focusable thumbs; toolbar shortcuts reuse store actions.
Timeline header width uses one inherited variable for ruler, song, folders, automation and lanes; height drags preview in the DOM and commit once to avoid audio churn. Phone arrangement and mixer reuse desktop controls with native scrolling.
Timeline ruler synchronization uses untransformed layout width (offsetWidth), so the sideways body canvas cannot substitute arrangement height for width; phone song growth adds scrollable bar space instead of compressing clips.
Touch mixer styling is scoped by data-touch-console; keep desktop strips and audio routing shared while sizing phone targets independently.
Phone studio always opens on the edit screen: entering the studio or resuming the page closes any tool panel, so an instrument like the drum machine never greets the user first.
Studio View back side (StudioBack.tsx) mirrors the real signal path — track → inserts → mixer channel → master → monitors/reel plus bus sends; re-patching a cable performs the matching store action (insert reorder, bypass, send level), never a visual-only change.
Studio cable menus and jacks share studioCablePatch for atomic insert/send changes; only same-channel supported routes are offered, keeping fixed output feeds honest.

Studio rear devices follow the front room's furniture zones inside one scrollable measured canvas; keep the cable SVG and jack positions in that same coordinate space so horizontal and vertical scrolling preserve connections.
Drum-channel razor/split unrolls pad steps to song length and reuses track.cuts/activeRegion; deleting a part zeroes those steps. Generate Stem isolates the chosen part with Demucs (lib/synclab/ai-isolate) and falls back to on-device cleaning when the AI service fails.

Timeline recording drags use pointer-based new-channel drop bounds and edge scrolling; transfer single clips atomically through track-move so sibling takes stay put and covered source notes/hits clear.
WaveformView collapses to its intrinsic 16px inside a <button> (pad grids, chop tiles); give it `className="!h-full !w-full"` there, as VideoSampler chop tiles and PadSampler pad strips do.

Pad Sampler saves source-relative chop ranges; bank transforms preserve the source and require replacement confirmation. Pitch-preserving pad stretch runs shared WSOLA offline in a worker and retains pad shaping and manual-save semantics.

Device-conditional UI reads `useIsAppleMobile()` (`src/hooks/use-is-apple-mobile.ts`), never `isAppleMobile()` inside a render body — the server and an iPad would disagree and hydration breaks; `outputRoutingHint(apple)` takes the flag for the same reason. `canPickOutput` stays a pure browser-capability check: iPadOS reports `setSinkId` as available yet every call rejects, so the Output picker is suppressed by the Apple flag and `setOutputDevice` refuses with the Control Centre hint.

HardwareWindow moves/resizes the existing mounted whole editor in canvas coordinates; never clone instrument instances, audio owners, effect devices or modular modules for window presentation.

Plugins cabinet presentation wraps existing RackEffect instances and a responsive installed-device browser; cabinet texture and scoped faceplate styles never change processing or duplicate plugin state.
EffectWorkbench packs existing parameters in wrapping control banks beside real displays; container widths support rack/mixer and sideways phones. data-fx-skin/family preserves identity without duplicate state. Keep dedicated EQ/vocoder editors and isolated touch-sized channel menus.
Effect response/scope window skins use per-kind attributes in shared displays; frame/layout changes never alter DSP, signal taps, EQ curves or pointer coordinates.
Modular scopes branch from voice outputs, sum active taps at 20 fps and release on voice end; offline voices omit observers.
Synth and drum console finishes scope shared Knob parts and section hooks to the existing instrument wrappers; retain tab structure and DrumRoll geometry so hardware styling never changes audio or phone editing.
Studio rear mirrors front furniture in one measured canvas; phone Fit scales it with cables, while 100% retains native scrolling/routing. Both room canvases share wall art with CDN pointers and source/license credits, clear of equipment.

Timeline.tsx and Mixer.tsx are thin entry points; their parts live in timeline/ (shared, clips, TrackRow, AutomationRow, EditToolbar, Ruler) and mixer/ (shared, InsertRack, ChannelEq, Strip, BusStrips, MasterStrip, PhoneMixer). Add new timeline/mixer code to the matching module instead of regrowing the entry files.
Knob is the one rotary control (drag/Shift-fine, non-passive wheel, arrows/Page keys, Home or double-click to defaultValue, inline layout for compact rows); mixer pan and master width use it instead of sliders, faders stay vertical sliders.
Mixer readouts show peak hold from clip-monitor (raw maxima since reset); the CLIP button resets both the clip light and the peak.
Timeline file drops land at the dropped grid position (drop-position.ts); Ctrl/Cmd+wheel zooms around the pointer; Mod+D duplicates the selected clip exactly after itself (clipCopyAfter) before falling back to track duplication. The small per-clip quick menu (data-part-quick-menu) never blocks shortcuts.
MIDI parts between cut marks move on their own (moveNoteRegion) and both edges trim (trimNoteRegion); drum parts move, trim from the left edge, stretch from the right edge, Alt + right edge trims (trimDrumPart). Moves and trims are clamped to the free room between neighbouring parts with content, so parts never overlap; an uncut pattern still moves as a whole.

Sound screens use shared tokens and real parameter drag points with 20 fps signal drawing, never fake wave activity.
Effect editors share EffectPresetMenu and a kind-specific factory recipe library; derive the selected name from stored parameter values so manual edits, project reloads and track/bus/master editors agree without duplicate preset state.
Modular Tech uses definition-driven controls and narrow/wide hardware decks; each module type must implement matching DSP ports in the shared voice builder so saved patches, live preview and offline export agree. Cable centers use canvasPoint against the SVG overlay so sideways-phone transforms cannot offset connections.
The "My Computer" file list is one shared ComputerFiles component used by the desktop left menu and the phone/narrow navigation bar, so both stay in sync.
Knob draws one SVG dial (track ring, value arc lit from min or from a centred defaultValue, dark body, white pointer) coloured only through --knob-accent; devices restyle knobs by setting that variable, never by adding grip/cap markup. Effect faces take their colour from a per-kind --fx-hue at the end of styles.css so every effect keeps its own identity on the shared slate face.

Arrangement track headers (and their colour stripe/folder rows) are `position: sticky; left` inside #timeline-scroll so they stay aligned with the ruler's compensated left cell; the selected row's z-index creates a stacking context, so the song playhead is clipped by a wrapper using `--timeline-scroll-x` rather than relying on header z-order. Phone browsers hide styled scrollbars, so the phone timeline draws its own TimelineVScrollbar (vscroll-math.ts) in a reserved right strip.
Sideways-phone mixer is big-control only (no full-desk toggle): desk toolbar controls live in PhoneMixerMenu, bus/VCA/aux render as touch strips, and the shared TimelineHScrollbar (zoom optional) scrolls the channel row; tablets keep the desk toggle, and per-channel More still opens the full strip so no routing is lost.

Phone mixer "⋯" windows (PhoneChannelControls) give tracks, buses, VCAs, aux returns and master tabbed big-touch sections that reuse the desk strips' store actions and shared hooks (useTrackEq, useMasterFx); never embed the desk Strip/MasterStrip there, so phone controls stay finger-sized without duplicating mixer state.
Keyboard keys print every note name like a piano chart (white letters, flat-over-sharp on black keys) on phone and desktop; labels sit above the typing-letter hint so neither overlaps.
Sideways-phone pop-ups: swipes inside dialogs/menus stop at <body> (lib/synclab/sideways-scroll.ts) so Radix's screen-axis scroll lock cannot block scrolling in the rotated canvas; phone mixer FX use centred dialogs (PhoneFxWindow) rather than anchored popovers, whose positioning breaks under rotation. Keyboard labels scale with each key via container units; black keys centre on the boundary of the white keys they sit between.
Channel renaming is a visible pencil (RenameTrackButton / TrackRow beginRename) on the timeline header and every mixer name plate, opening NameEditDialog; both views read the one Track.name, so renaming anywhere updates both.
Pop-up menus (ui/dropdown-menu Content/SubContent) ignore the finger lift that opened them via useGhostTapGuard + lib/ghost-tap.ts: a choice must start with a press inside the menu, because phone menus open on touch-down and the lift would otherwise pick the item under the finger (e.g. Cut). Phone track headers are user-select:none with no touch callout.
