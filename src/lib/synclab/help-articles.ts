/**
 * Built-in Help Center articles, grouped by category. Each article says how to use a feature,
 * what it can do and — honestly — what it can't do (browser, phone or provider limits).
 * Shipped with the app so help works offline.
 */
export const HELP_CATEGORIES = [
  "Getting started",
  "Recording",
  "Timeline & editing",
  "Synths & keys",
  "Drums & beats",
  "Samplers & video",
  "Mixing & effects",
  "Performance & DJ",
  "AI & smart tools",
  "MIDI & hardware",
  "Files & export",
  "Phone & tablet",
  "Desktop app & plugins",
  "Account & billing",
] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number];

export type Article = {
  id: string;
  category: HelpCategory;
  title: string;
  tags: string;
  /** how to use it */
  body: string[];
  /** what it can do */
  can: string[];
  /** what it can't do (honest limits) */
  cant: string[];
};

export const KNOWLEDGE_BASE: Article[] = [
  // ───────────── Getting started ─────────────
  {
    id: "workspace", category: "Getting started", title: "The start screen and workspace",
    tags: "start welcome workspace templates recent cloud open new project",
    body: [
      "The start screen lists your cloud projects, projects opened on this device, starter templates and your own saved templates.",
      "Pick a template or a blank project to open the studio. The menus at the top (File, Edit, View, Track, Clip, Audio, Transport, MIDI, Tools, Settings, Window, Help) work the same on computer and phone.",
      "The left menu (SYNCLAB TOOLS) opens every instrument and tool. Search Studio, above the timeline, finds any tool by name.",
    ],
    can: [
      "Open, rename and delete cloud projects from the start screen.",
      "Start from starter templates or your own saved templates.",
      "Use Split View to see an editor and the timeline together (on a computer).",
      "Pop out a panel into its own window and move it to another monitor.",
    ],
    cant: [
      "Projects are not saved by themselves — see “Saving projects”.",
      "Pop-out windows need your browser to allow pop-ups for SYNCLAB.",
    ],
  },
  {
    id: "projects", category: "Getting started", title: "Saving projects and undo",
    tags: "save manual save recovery cloud recent rename undo redo close",
    body: [
      "Save with File → Save or Ctrl/Cmd+S. Saved projects appear in your cloud projects and in Recent.",
      "If you close a project with unsaved changes, SYNCLAB asks whether to save first. If a recording is still finishing, it waits for it before saving.",
      "Undo (Ctrl/Cmd+Z) steps back one edit at a time.",
    ],
    can: [
      "Save to your account and open the same project on phone and computer.",
      "Undo and redo edits.",
      "Delete cloud projects; their files are cleaned up too.",
    ],
    cant: [
      "There is no autosave — anything not saved is lost when you close.",
      "The free version can't save projects. Saving needs the free trial or a plan.",
    ],
  },
  {
    id: "shortcuts", category: "Getting started", title: "Keyboard shortcuts and computer keys",
    tags: "shortcuts keyboard space play stop qwerty computer keys typing",
    body: [
      "Space plays and stops. Help → Keyboard shortcuts lists and changes the rest.",
      "Your computer's letter keys play the armed or selected instrument like a piano, and they record when you record.",
    ],
    can: [
      "Play and record notes from your computer keyboard.",
      "Change shortcuts in Settings.",
    ],
    cant: [
      "Shortcuts pause while you type in a text box, so typing a name never triggers them.",
      "Computer keys are not velocity-sensitive — every note plays at the same level.",
    ],
  },

  // ───────────── Recording ─────────────
  {
    id: "recording", category: "Recording", title: "Recording audio and vocals",
    tags: "recording microphone vocals input monitor arm punch take count-in overdub replace",
    body: [
      "Add an audio track and press ARM. SYNCLAB opens your microphone so you can see the input level before you record. New tracks you add are armed for you.",
      "Press REC in the transport. With Count-in on, the bars you chose click first and the song starts exactly on the next beat 1. Your microphone is already listening during the count-in, so you can come in right on the first beat.",
      "Without a count-in, SYNCLAB waits until the microphone is listening (usually a split second) before the song starts, so the first beat is never cut off.",
      "Loop recording keeps every pass as its own take so you can pick the best one; punch in/out limits recording to the loop.",
      "Recording a synth captures the notes you play. With Overdub on, recording keeps going round the loop and everything you played keeps playing, so you can layer pass after pass. When you stop, the waveform block is drawn from your notes.",
      "Deleting a recorded synth or drum block also deletes the notes or hits underneath it. Undo brings them back.",
      "Cutting a recorded block (CUT or ⌘X / Ctrl+X) also takes the notes or hits underneath it. Cut never removes the instrument itself — only Delete track does.",
    ],
    can: [
      "Record microphone and interface inputs, with takes and loop recording.",
      "Choose Replace (new recording replaces what's there) or Overdub (stacks on top; on a synth it keeps looping so you can layer passes).",
      "Correct for your device's recording delay in Settings → Audio.",
    ],
    cant: [
      "A browser can't change your interface's buffer size or sample rate.",
      "If the meter goes red the sound is clipping — turn the gain down on your interface; SYNCLAB can't undo clipping after it's recorded.",
      "In Replace mode a synth take still stops at the loop end. Synths played from outside hardware record notes only, with no waveform.",
    ],
  },
  {
    id: "mic", category: "Recording", title: "My microphone or audio interface is not detected",
    tags: "mic microphone volt interface permission device audio input blocked",
    body: [
      "Open Settings → Audio and pick your input device. Interfaces appear once they are plugged in and the browser has permission.",
      "If the browser blocked the microphone, allow it in the address bar and reload.",
      "Some computers let only one app use an interface at a time. Close other audio apps and try again.",
    ],
    can: [
      "Pick any input and output the browser can see.",
      "Switch inputs during a session; if the device is unplugged, the take stops and keeps what was recorded.",
    ],
    cant: [
      "Device names stay hidden until you allow microphone access.",
      "On iPhone and iPad, Apple decides the routing — see “Audio interfaces on iPad and iPhone”.",
    ],
  },
  {
    id: "interface-ipad", category: "Recording", title: "Audio interfaces on iPad and iPhone",
    tags: "ipad iphone ios ipados interface volt scarlett usb-c control centre input output routing powered hub webkit safari sample rate",
    body: [
      "iPadOS 17 and later recognise most USB-C audio interfaces without drivers. Open Settings → Audio, press Detect devices and allow the microphone.",
      "Output: open Control Centre, tap the audio card at the top right and choose your interface.",
      "Power: many interfaces need a powered USB hub on iPad; an iPhone won't power a large interface.",
    ],
    can: [
      "Record through a class-compliant USB-C interface on a recent iPad.",
      "Play through the interface's outputs once chosen in Control Centre.",
    ],
    cant: [
      "A web page can't choose the speaker on iPad — Control Centre does that.",
      "Safari has a known Apple bug where it may keep using the built-in mic even when the interface is listed. If the meter only moves when you talk into the iPad, that bug is the cause; record on a computer instead and open the project on iPad.",
      "The sample rate can't be changed from the browser; set the interface to 44.1 kHz in its own app if it crackles.",
    ],
  },
  {
    id: "reel", category: "Recording", title: "Reel-to-Reel Recorder",
    tags: "reel tape recorder quicktime record capture export",
    body: [
      "Open Reel-to-Reel Recorder from PERFORM. Press record to capture your input or the studio, watch the reels and meters move, then export the tape as a file.",
      "Switch between the reel look and the QuickTime-style look at the top.",
    ],
    can: [
      "Record, play back and export the tape as an audio file.",
      "Use working knobs and live meters on phone and computer.",
    ],
    cant: [
      "The tape has its own transport — it doesn't start, stop or follow the song's Play button.",
    ],
  },

  // ───────────── Timeline & editing ─────────────
  {
    id: "timeline", category: "Timeline & editing", title: "Timeline, tracks and loop markers",
    tags: "timeline loop markers tracks tap double tap menu zoom follow snap playhead",
    body: [
      "Tap a track once to open its menu. Double-tap a drum track to open the drum roll, or a synth track to open the piano roll.",
      "Drag the loop markers at the top, or drag the band between them to move the whole loop. Drag the white playhead from the ruler or a track lane.",
      "The bar above the timeline holds Edit, Clip, Quantize, Grid, Import, the bar-length menu, Count-in, Overdub/Replace and Follow.",
    ],
    can: [
      "Add, rename, colour, duplicate, mute, solo and delete tracks.",
      "Resize the track-name area and zoom the timeline.",
      "Follow the playhead while playing.",
    ],
    cant: [
      "Only an explicit Delete track removes a channel — deleting a part never removes its track.",
    ],
  },
  {
    id: "clips", category: "Timeline & editing", title: "Cutting, moving and pasting clips",
    tags: "clip cut razor split paste copy duplicate move fade quantize mono stereo trim extend",
    body: [
      "Use the cut tool to split a clip exactly where the guide line shows. Drag clips to move them to another time or track.",
      "Move a note block or beat part to another track: drag it up or down onto that track's lane (a dashed outline shows where it lands), or tap the block and choose To track above / To track below. The track menu also has Move part to… for the selected part.",
      "To delete one block, tap it and press Delete in the small menu next to it (or Delete selected part in the track menu). Only that block goes; the rest of the track stays.",
      "Copy, then Paste places the material at the playhead on the selected track and keeps that track's settings. Duplicate track makes a full copy of the channel.",
      "In the audio clip editor you can quantize a recording to the beat, add fades, and make a mono or stereo copy.",
    ],
    can: [
      "Cut audio, MIDI and drum parts; move, copy, paste and delete parts.",
      "Move a synth/MIDI/sampler note block to another note track, or a beat part to another drum track, keeping its position or dropping it at a new bar.",
      "Stretch an audio clip longer from its right edge without changing pitch.",
      "Fade in/out, reverse and normalize clips.",
    ],
    cant: [
      "Edits never change your original file — they only change how it plays.",
      "Note blocks only move onto synth, MIDI or sampler tracks that show notes, and beat parts only onto drum tracks. Drum hits land on the same kind of drum; hits with no matching drum on the other kit are left out (you'll see how many).",
      "On a phone, dragging a block up or down may scroll the timeline instead — use To track above / below in the block's menu.",
      "Very large stretches will sound processed.",
    ],
  },
  {
    id: "pianoroll", category: "Timeline & editing", title: "Piano roll and notes",
    tags: "piano roll notes quantize grid snap draw select erase velocity humanize",
    body: [
      "Draw, Select and Erase modes sit above the grid. Drag notes to move them, drag the edge to resize, and use the lane below for velocity.",
      "Quantize snaps notes to the grid; Humanize nudges them slightly off it again.",
      "Every editor shares one timebase, so a note at bar 3 beat 1 shows at bar 3 beat 1 everywhere.",
    ],
    can: [
      "Copy, cut and paste notes inside the piano roll.",
      "Place notes from the piano roll's own ruler without moving the song playhead.",
    ],
    cant: [
      "Notes are edited inside the loop markers when a loop is set — move the loop to reach other bars.",
    ],
  },
  {
    id: "automation", category: "Timeline & editing", title: "Automation",
    tags: "automation auto lanes write touch latch read volume pan send",
    body: [
      "Press AUTO on a track to show automation lanes for volume, pan, sends and device knobs.",
      "Draw points, or choose Write, Touch or Latch and move a fader while playing to record the move.",
    ],
    can: [
      "Automate faders, pan, sends, mutes and effect settings.",
      "Record mute/solo presses during a take and hear them played back.",
    ],
    cant: [
      "Live View performance effects are not recorded as automation and are not in exports.",
    ],
  },
  {
    id: "notes", category: "Timeline & editing", title: "Project notes",
    tags: "notes notepad lyrics save",
    body: ["Press NOTES at the top of any panel to write lyrics or reminders, then press Save on the note."],
    can: ["Keep written notes with your project."],
    cant: ["Notes are saved with the project, so they need a project save too."],
  },

  // ───────────── Synths & keys ─────────────
  {
    id: "synths", category: "Synths & keys", title: "The five synths",
    tags: "synth spec 4 acid bass poly modular granular presets preset browser categories sound type style favorites arpeggiator arp rhythm note pattern sequence chord piano grand rhodes wurlitzer electric piano xy tabs",
    body: [
      "Spec 4, Acid Bass (TD-3), Poly Synth, Modular Tech Synth and Granular Synth each have their own look and sound. Controls are grouped into tabs.",
      "Click the preset window to open the preset browser. The left side lists sound types (Bass, Lead, Pad, Strings, Choir…) with how many sounds each has, then Styles (genres like Detroit Techno or Rave) and My Presets. Click a type to see its sounds on the right, and click a sound to load and hear it. The browser stays open so you can try the next one; press Done or click outside to close it.",
      "Type in Find to search every preset by name or type. The ◀ ▶ arrows step through presets in the browser's order.",
      "Every preset sits in one sound type. Spec 4 and Poly Synth use Arpeggio, Bass, Brass, FX, Keyboard, Lead, Organ, Pad, Percussive, Sequence, Strings, Synth, Template and Woodwind, plus Bell, Pluck, Stab and Vocal. Acid Bass splits into Acid Bass and Clean Bass (no distortion), with Electro and Techno styles. Granular Synth sorts its 33 grain sounds into Bell, Choir, Drone, FX, Keyboard, Pad, Pluck, Rhythmic and Texture. Modular Tech patches are sorted by sound too.",
      "Favorite preset keys: tap an empty key or Add current to store the preset you're on, tap a filled key to load it, and use Edit to replace or clear keys.",
      "Pianos: the Piano sound type (and Keyboard on Poly Synth) has grand, bright, felt, upright, honky-tonk, tine electric (Rhodes-style), reed electric (Wurlitzer-style) and toy pianos. They come from the Piano engine on the Oscillators tab, which models struck strings or electric-piano tines and reeds: notes ring and fade like a real piano, and harder playing sounds brighter. You can switch it on in any Spec 4 or Poly Synth sound and mix it with the oscillators.",
      "Arpeggiator tab: besides direction, octaves, gate and swing you pick a RATE (1/4 to 1/64, with dotted and triplet speeds), a RHYTHM (where notes, accents, holds and rests fall) and a NOTE PATTERN (a riff laid over the keys you hold, so one key can play a whole line). Direction 'chord' plays all held keys together on each hit. Every arpeggio and sequence preset has its own speed, rhythm and riff.",
    ],
    can: [
      "Play from a MIDI keyboard, the on-screen keys or your computer keys.",
      "Use the arpeggiator and X-Y pads; every move matches the knobs and saved presets.",
      "Hold a chord on an arp preset and it plays the chord one note at a time, in the song, in exports and when you play live.",
      "Play the modelled pianos softly for a mellow tone or hard for a bright, punchy one.",
      "Save your own presets.",
    ],
    cant: [
      "Favorite keys are saved on each device, so your phone and computer keep separate lists.",
      "Changing a sound affects the next notes you play, not a note that is already held.",
      "Brass, strings, woodwind and organ presets are synth imitations, not recorded instruments. The pianos are modelled (built from maths), not recorded samples, so they are close to a real piano but not identical, and the built-in synths have no sustain pedal yet.",
      "Since November 11, songs that already use an arp sound different: held chords are now arpeggiated note by note during playback (before, the whole chord repeated). Arp presets you loaded before then keep their old settings until you load the preset again.",
      "The first time you play a piano note in a new range it can take a moment longer while that range is prepared; the common range is prepared in the background when a piano sound is loaded.",
      "Presets in the same sound type (for example five brass sounds) are variations, so they can sound close to each other. The Template presets are plain starting sounds and are meant to sound basic.",
      "Since November 11 the synths' built-in warmth is much lighter so each preset keeps its own character. Synth parts sound a little quieter and less squashed than before; turn up DRIVE or DIST for grit.",
      "Clean Bass presets only stay clean until you turn up DRIVE or DIST yourself.",
      "Older genre-group presets are sorted into a sound type by their name, so a few may sit in a type you wouldn't pick; their genre is still listed under Style.",
    ],
  },
  {
    id: "touch-synth", category: "Synths & keys", title: "Touch Synth",
    tags: "touch synth lanes loops genre grid",
    body: [
      "Touch Synth has five lanes, including separate coloured drum columns, plus genre loops. Tap the grid to add or remove notes, then Send to timeline.",
    ],
    can: [
      "Load genre loops and edit each note.",
      "Overdub while the loop plays and send the result to the timeline.",
    ],
    cant: ["On phone it lives under Synth, not Sounds."],
  },
  {
    id: "bass-generator", category: "Synths & keys", title: "Bass Generator",
    tags: "bass generator bassline 303 steps presets shift send to",
    body: [
      "Pick a template or preset — each has its own bass melody. Edit the 16 or 32 steps, use SHIFT ◀ ▶ to move the pattern, and SEND TO a track.",
    ],
    can: [
      "Make clean (undistorted) basslines and edit every step.",
      "Send the pattern to the timeline.",
      "Generate, preview and add basslines while your song is playing or recording — nothing stops. Pressing Generate again during a preview swaps in the new line in time, without jumping back to the start.",
    ],
    cant: ["It writes bass patterns only; it doesn't make drums or chords."],
  },
  {
    id: "live-keys", category: "Synths & keys", title: "Live Keys (virtual keyboard player)",
    tags: "live keys keyboardist piano jazz styles print chords",
    body: [
      "Choose one of 52 styles in seven groups (including Jazz), set the key and CHORDS, and press play. Preview it alone or with your song, then print it to the timeline.",
    ],
    can: [
      "Play along with your song, change style while it plays, and print an editable part.",
      "Print while the song plays or records: the printed part takes over on the next beat with no gap. If the part you print doesn't cover where the song is, the player keeps playing until you stop it.",
      "Press Play with song while previewing alone and the player locks onto the song's beat.",
      "Keep playing while you switch panels.",
    ],
    cant: [
      "Preview alone pauses your song (and is blocked while recording), because it plays the keys on their own.",
      "It plays the chords you set; it doesn't listen to your audio to work out the chords.",
      "Parts printed before an update keep their older sound — print again to hear the new one.",
    ],
  },
  {
    id: "vocoder", category: "Synths & keys", title: "Vocoder, voice synth and Convert Voice",
    tags: "vocoder robot carrier modulator formant voice convert pitch deeper chipmunk male female",
    body: [
      "Vocoder: choose a carrier (usually a synth) and a modulator (your voice); the synth takes the shape of your voice.",
      "Convert Voice: record or import a vocal, pick a preset such as Deeper, Chipmunk, Robot or Male → Female, preview it and add it to a track.",
    ],
    can: [
      "Change pitch and character of a voice on your device.",
      "Use your own recordings or clips already in the project.",
    ],
    cant: [
      "Convert Voice changes pitch and tone; it can't make you sound like a specific real singer.",
    ],
  },

  // ───────────── Drums & beats ─────────────
  {
    id: "drum-machine", category: "Drums & beats", title: "Drum Machine",
    tags: "drum machine drum roll pads banks patterns chain kit note repeat swing",
    body: [
      "Drum roll: tap a step to cycle ghost → normal → accent, drag to paint, right-click to clear. Tap a drum's name for its tools.",
      "Banks A–H and patterns 1–8 hold different beats; Chain plays patterns in the order you add them.",
      "Play pads: tap pads to play and record. Note Repeat rolls a held pad at the chosen rate.",
      "Sound and Kit: shape each drum and load kits.",
    ],
    can: [
      "Edit one hit or all hits of a drum at once (velocity, pitch, decay, chance, flam, roll, glitch).",
      "Copy banks/patterns, chain patterns and change swing.",
      "Play pads from a MIDI drum controller.",
    ],
    cant: [
      "Snap for new steps is for this session only and never moves hits that are already there.",
    ],
  },
  {
    id: "flam-roll-mutate", category: "Drums & beats", title: "Flam, Roll and Mutate",
    tags: "flam roll mutate drum fill double stroke retrig variation",
    body: [
      "Pick a drum in the drum roll, then use FLAM, ROLL or MUTATE in its tools row (or at the bottom of the Sound page).",
      "Flam adds a quick double hit to every hit of that drum; press again to turn it off. Roll plays each hit ×2, ×3, ×4 then off. Mutate adds, moves or removes a few hits.",
    ],
    can: [
      "Hear the change straight away; what you hear is what exports.",
      "Undo a Mutate; the MUTATE knob sets how much changes.",
    ],
    cant: [
      "They work on hits that exist — put some hits on the drum first.",
      "Mutate always keeps the hits on the beat and stays inside the loop markers.",
    ],
  },
  {
    id: "live-drummer", category: "Drums & beats", title: "Live Drummer",
    tags: "live drummer genres rock jazz latin hip-hop electronic band kit print",
    body: [
      "Pick a genre — World & Latin, Band, Hip-hop & R&B, Electronic, Rock or Jazz — and a style. The drum set changes with the genre and each piece lights up as it plays.",
      "Preview it alone or with your song, then print it to the timeline as an editable drum part.",
    ],
    can: [
      "Audition single drum pieces by tapping them.",
      "Print while the song plays or records: the printed part takes over on the next beat with no gap. If the part you print doesn't cover where the song is, the drummer keeps playing until you stop it.",
      "Press Play with song while previewing alone and the drummer locks onto the song's beat.",
      "Keep playing while you switch panels.",
    ],
    cant: [
      "Preview alone pauses your song (and is blocked while recording), because it plays the drummer on their own.",
      "It follows your song's tempo; it doesn't listen to your audio to follow a live player.",
    ],
  },
  {
    id: "hum-to-beat", category: "Drums & beats", title: "Hum to Beat",
    tags: "hum beatbox melody voice to notes",
    body: [
      "Beatbox and SYNCLAB turns deep “boom” sounds into kicks, “pff/ka” into snares and “ts” into hi-hats. Or hum a melody to get notes.",
      "Check the waveform and notes, preview, then add them to the timeline.",
    ],
    can: ["Turn your voice into drum hits or synth notes."],
    cant: ["Hum one note at a time with short gaps — chords and fast runs are not recognised."],
  },

  // ───────────── Samplers & video ─────────────
  {
    id: "sampler", category: "Samplers & video", title: "Sampler: loading, trimming and time stretch",
    tags: "sampler sample trim stretch pitch loop adsr reverse normalize zoom",
    body: [
      "Drop an audio file on the Sampler or record into it. Drag the start and end handles to trim; zoom in on the waveform for detail.",
      "Time stretch changes length without changing pitch; pitch changes tone without changing length.",
    ],
    can: [
      "Reverse, normalize, loop and shape the sound with ADSR and filter.",
      "Chop the sample into slices you can play from keys or pads.",
    ],
    cant: [
      "Trimming never changes the original file.",
      "Extreme stretch settings will sound processed.",
    ],
  },
  {
    id: "sample-sources", category: "Samplers & video", title: "Recording into the samplers (mic, computer audio, SYNCLAB)",
    tags: "system audio computer audio record sampler koala screen share loopback synclab mix",
    body: [
      "In Sampler or Pad Sampler, pick the source: Microphone, Computer audio, or SYNCLAB mix (what SYNCLAB is playing). Then record.",
      "Computer audio asks you to share a tab or screen — tick “Share audio”.",
    ],
    can: [
      "Record your mic, the sound of your computer (Chrome or Edge on a computer), or SYNCLAB's own mix on any device.",
      "Import MP4/MOV screen recordings and use their sound.",
    ],
    cant: [
      "Phones can't record other apps' sound from a browser. Screen-record on the phone, then import the video.",
      "Safari and Firefox on a computer can't share system audio.",
    ],
  },
  {
    id: "chopper", category: "Samplers & video", title: "Pad Sampler and chopping",
    tags: "chop slice transient pads bars divisions mpc pad sampler",
    body: [
      "Chop by transient, beat, bar or equal parts, or place slices by hand. Pick 4, 8, 16 or 32 slices; each lands on its own pad.",
    ],
    can: [
      "Rearrange, reverse, pitch, stretch and fade each pad.",
      "Use gate and choke so pads cut each other off.",
    ],
    cant: ["On phone, Pad Sampler opens from the SAMPLERS switch next to Sampler."],
  },
  {
    id: "video-sampler", category: "Samplers & video", title: "Video Sampler",
    tags: "video sampler mp4 mov cuts youtube",
    body: ["Load a video file, cut it on the grid and play the cuts from pads or MIDI."],
    can: [
      "Cut and play video with its sound; save kits with their MIDI notes.",
      "Open saved videos from your media library.",
    ],
    cant: [
      "It can't download from YouTube or other sites — that breaks their rules. Use your own video files.",
      "The video picture isn't exported with your song, only the sound.",
      "Which video files play depends on your browser.",
    ],
  },

  // ───────────── Mixing & effects ─────────────
  {
    id: "mixer", category: "Mixing & effects", title: "Mixer, buses, VCAs and returns",
    tags: "mixer bus send return fader pan mute solo eq routing vca aux gain meters dock studio pro f3 full view",
    body: [
      "Each channel has a GAIN knob, EQ, sends, pan, mute, solo and a fader. Buses group channels, VCAs move several faders at once, and returns hold shared effects.",
      "On a computer the mixer opens docked under the timeline, like Studio Pro. Drag the bar between them to give the mixer or the timeline more room (double-click the bar to reset it). Press F3 to show or hide the mixer.",
      "Full view (at the right end of the mixer's top bar) gives the mixer the whole screen with every row; Dock under timeline in its header puts it back. Your choice and the docked height are remembered on that computer.",
      "On phone, swipe sideways through channels and use ⋯ for each channel's menu.",
    ],
    can: [
      "Route tracks to buses and sends; learn mixer controls to a MIDI controller.",
      "Read true levels on the meters; the red zone means clipping.",
    ],
    cant: [
      "A VCA scales the channels it controls without moving their own faders.",
      "The docked mixer shows the main rows (gain, inserts, sends, pan, fader, mute/solo). Channel EQ, output routing and the channel scope are only in Full view.",
      "On a short screen the docked channels scroll up and down if they don't fit; drag the bar up for taller faders.",
    ],
  },
  {
    id: "effects", category: "Mixing & effects", title: "Effects and the FX Rack",
    tags: "effects fx rack plugin presets bypass reverb delay compressor eq distortion chorus maximizer imager drag",
    body: [
      "Add effects from the FX Rack, the mixer or a track menu, or drag one onto a track in the timeline. Effects are sorted by category.",
      "Each effect has its own presets (15 each for the hardware-style units) and a BYPASS button.",
      "Effects that work alike each have their own character: Stereo Delay bounces echoes left and right, Tape Echo has up to three tape heads, wow & flutter and tape saturation, Mod Engine swirls between the speakers, Stereo Imager's Stereoize widens even mono sounds, Analog Filter has an analog drive, and Harmonic Body rings for as long as its Decay knob says.",
    ],
    can: [
      "Stack effects on any track, bus or the master, with live scopes and meters. Press a scope's corner button to open it big — see “Expanding a scope”.",
      "Bypass any instrument or effect without losing its settings.",
      "Turn knobs while the song plays or records. The sound changes smoothly, and reverb tails keep ringing when you change Decay.",
    ],
    cant: [
      "Flipping a switch that changes how an effect is built — a mode, type or cabinet selector, phaser stages, or any Vocoder control — rebuilds that effect with a very short crossfade.",
      "A very slow phone or computer can still fall behind if it's busy for longer than about a third of a second.",
      "These are SYNCLAB's own effects. Your own VST/AU plugins can't run in the browser — see “Desktop app and plugins”.",
      "Channel EQ, Pro-EQ 8, Utility Gain and Stereo Width start flat, so they change nothing until you turn a knob or pick a preset. Stereo Width can't widen a mono sound — use Stereo Imager's Stereoize for that.",
    ],
  },
  {
    id: "scope-window", category: "Mixing & effects", title: "Expanding a scope (Spectrum Analyzer)",
    tags: "scope spectrum analyzer analyser oscilloscope expand big window frequency follow selection peak hold",
    body: [
      "Every scope has a small expand button in its corner — on effects, mixer channels, buses, the master, the transport bar, the Pro EQ and the Modular Tech modules. Press it to open the big Spectrum Analyzer window on the same signal.",
      "The window shows frequencies from 20 Hz to 20 kHz and real levels from 0 dB down to −96 dB. Switch between Spectrum and Scope (the waveform) at the top. Pick any channel, bus, effect or the Master Section from the menu at the bottom, or tick Follow Selection to watch whichever channel you select.",
      "On a computer, drag the title bar to move it and the bottom-right corner to resize it. On a phone it fills the screen. Press × or Esc to close.",
    ],
    can: [
      "See the full frequency picture of any channel, bus, effect or the master while the song plays or records, without changing the sound.",
      "Turn Analyzer off, keep a Peak hold line, and point at the graph to read the frequency and level under your finger or mouse.",
    ],
    cant: [
      "The Scope view zooms quiet signals so you can see their shape; the dB numbers always show the true level.",
      "A bypassed effect has no output of its own to show — pick the channel instead.",
      "Modular Tech module taps only show the waveform, not the spectrum. The sampler's recording waveform is not part of this window.",
      "Only one big window opens at a time.",
    ],
  },
  {
    id: "amps", category: "Mixing & effects", title: "Amps & Pedals",
    tags: "guitar bass amp pedals stompbox amp room",
    body: ["Open Amps & Pedals to put guitar or bass amps and stomp pedals on a track. Step on a pedal's footswitch to bypass it."],
    can: ["Play guitar or bass through your interface with amp and pedal sounds."],
    cant: ["Expect a short delay when playing live through a browser; the desktop app does not remove it yet."],
  },
  {
    id: "mastering", category: "Mixing & effects", title: "Mastering",
    tags: "master mastering loudness lufs limiter club streaming",
    body: [
      "Mastering measures loudness and peaks, then applies EQ, width, glue, drive and limiting. Presets cover streaming, club and vocal-forward targets; A/B compares with the plain mix.",
    ],
    can: ["Master your song and export the mastered file."],
    cant: ["Saving the mastered file needs the trial or a plan."],
  },
  {
    id: "studio-view", category: "Mixing & effects", title: "Studio View",
    tags: "studio view room instruments stands monitors",
    body: ["Studio View shows your project's instruments, mixer and effects racks in a room. Tap one to open it."],
    can: ["Open any editor from the room and see real levels move."],
    cant: ["It shows your project — it isn't a separate set of instruments."],
  },
  {
    id: "wallpaper", category: "Mixing & effects", title: "Panel wallpaper and skins",
    tags: "wallpaper skin background theme colour",
    body: ["Use Wallpaper, Background and Save theme at the top of a panel, or drop a picture onto it. Settings → Appearance applies one picture to many panels."],
    can: ["Give each panel its own picture or colour and save themes."],
    cant: ["Wallpaper only covers the area around controls, so knobs and keys stay readable."],
  },

  // ───────────── Performance & DJ ─────────────
  {
    id: "dj-decks", category: "Performance & DJ", title: "DJ Decks",
    tags: "dj decks turntables serato mixer crossfader sync cue loop scratch playlist record mix headphones",
    body: [
      "Load music on Deck A and Deck B, beat-match with SYNC, mix with gain, EQ, filter, faders and the crossfader, and press Record mix to record your set.",
      "Scratch or spin the record, move the tone arm, or press ◀◀ to go back to the start. Hot cues and loops sit under each deck.",
      "Playlists: Add music, New, Save, Rename and Delete. On a computer the track list under the waveforms shows name, artist, length and BPM; press A or B to load.",
      "Headphone CUE lets you hear a deck before the crowd does.",
    ],
    can: [
      "Record the mix as WAV or MP3.",
      "Split cue and master to left/right ears with MONO SPLIT, or send headphones to a second output with 2ND OUT.",
      "Keep playing while you switch panels.",
    ],
    cant: [
      "2ND OUT only works in Chrome or Edge on a computer — not on iPhone or iPad.",
      "It doesn't stream from Spotify, TIDAL or other services; use your own music files.",
      "If a file has no info inside it, the artist shows as — and BPM is worked out from the audio.",
    ],
  },
  {
    id: "dj-hardware", category: "Performance & DJ", title: "Connecting a DJ controller",
    tags: "dj controller hardware pioneer ddj 400 flx4 midi learn jog lights",
    body: [
      "Plug in by USB (or pair Bluetooth MIDI), open the Controller section in DJ Decks (Controller button on phone) and press Connect controller.",
      "Pioneer DDJ-400 and DDJ-FLX4 work without setup. For other controllers, press Learn next to a job and move that control.",
      "To hear the decks through the controller's sound card, choose it as the Output in Settings → Audio.",
    ],
    can: [
      "Use play, cue, sync, hot cues, loops, EQ, faders, crossfader, jog wheels, browse and load from hardware.",
      "See lights on Pioneer DDJ buttons follow the decks.",
    ],
    cant: [
      "iPhone and iPad browsers can't see MIDI hardware.",
      "Only the Pioneer layout is built in; other controllers need Learn.",
      "SYNCLAB has only tested this with a simulated controller so far — tell us if your hardware acts differently.",
      "Keys learned on a normal keyboard only control the decks while DJ Decks is open.",
    ],
  },
  {
    id: "live-looper", category: "Performance & DJ", title: "Live Looper",
    tags: "live looper loops overdub start on sound pre-count",
    body: [
      "Name and record loops that start on the song's bar lines. Start on sound waits until your input is loud enough before recording.",
    ],
    can: ["Keep loops playing while you switch panels; send them to the timeline."],
    cant: ["Looper playback isn't recorded by the master recorder again, so loops are never doubled."],
  },
  {
    id: "live-view", category: "Performance & DJ", title: "Live View performance effects",
    tags: "live view performance effect pads hold",
    body: ["Touch and drag a pad to play an effect over the whole song. Let go to return to the dry sound, or tap HOLD to keep it on."],
    can: ["Play filter, delay and other effects live while performing."],
    cant: ["These live effects are not part of exports or saved automation."],
  },

  // ───────────── AI & smart tools ─────────────
  {
    id: "coproducer", category: "AI & smart tools", title: "AI Co-Producer",
    tags: "ai co-producer ideas chords basslines drums",
    body: ["Ask for ideas, chords, basslines or drum patterns. Ideas play as a preview before you add them."],
    can: ["Read your tempo, notes, track list, effects and mixer settings to suggest parts."],
    cant: [
      "It can't hear your audio — only your notes and settings.",
      "It needs sign-in and an internet connection, and counts toward your 25 AI uses a day.",
    ],
  },
  {
    id: "generate-stem", category: "AI & smart tools", title: "Generate Stem",
    tags: "generate stem ai music prompt style mood",
    body: ["Type a style or mood (for example “warm 90s R&B”), press Generate, then preview and add it to a new track."],
    can: ["Create a new music part from a description in about a minute."],
    cant: [
      "Needs sign-in and internet; counts toward your 25 AI uses a day.",
      "Cleaning a part down to one instrument happens on your device and some bleed can remain.",
    ],
  },
  {
    id: "stems", category: "AI & smart tools", title: "Separate Stems",
    tags: "stem separation split vocals drums bass on-device ai demucs",
    body: ["Load a song, choose On-device (free) or AI separation, then play each part and add the ones you want to the timeline."],
    can: ["Split a song into parts such as vocals, drums and bass."],
    cant: [
      "On-device separation finds vocals by their centre position, so mono files keep vocals mixed in.",
      "AI separation depends on an outside service, needs files under 40 MB, and may be unavailable at times — On-device always works.",
    ],
  },
  {
    id: "ai-limits", category: "AI & smart tools", title: "Daily AI limit",
    tags: "ai limit daily uses quota reset",
    body: ["Each account gets 25 AI uses per day. They reset at midnight UTC (7 PM Detroit time in winter, 8 PM in summer)."],
    can: ["If an AI request fails on the provider's side, the use is given back."],
    cant: ["The limit can't be raised from inside the app."],
  },

  // ───────────── MIDI & hardware ─────────────
  {
    id: "midi", category: "MIDI & hardware", title: "MIDI keyboards and controllers",
    tags: "midi controller keyboard cc learn clock sync device bluetooth thru",
    body: [
      "Open Settings → MIDI, or the MIDI IN button above the timeline, and turn on your controller. SYNCLAB reconnects to it after you unplug and replug it.",
      "Use Learn on a knob, fader or button, then move the control on your hardware.",
    ],
    can: [
      "Use several MIDI inputs at once, learn knobs/faders/buttons, and map drum pads.",
      "Send or follow MIDI clock so other gear stays in time.",
      "Connect Bluetooth MIDI keyboards in Chrome or Edge.",
    ],
    cant: [
      "MIDI works in Chrome and Edge (computer) and Chrome on Android — not in Safari or Firefox.",
    ],
  },
  {
    id: "midi-ios", category: "MIDI & hardware", title: "MIDI on iPhone and iPad",
    tags: "iphone ipad ios midi safari midiweb",
    body: ["Install the free MIDIWeb Browser from the App Store, open synclabsapp.com inside it, and connect your keyboard by USB cable."],
    can: ["Play SYNCLAB from a USB MIDI keyboard through MIDIWeb Browser."],
    cant: [
      "No browser on iPhone or iPad can see MIDI hardware on its own, at any iOS version — an update won't change that.",
      "Bluetooth MIDI isn't offered there; use a cable.",
    ],
  },

  // ───────────── Files & export ─────────────
  {
    id: "export", category: "Files & export", title: "Exporting your song, stems and tracks",
    tags: "export wav mp3 flac aiff m4a ogg stems bounce render share",
    body: [
      "File → Export lets you export the full mix, stems (each track) or one track. Choose a region with the export flags, or the whole song.",
      "Pick WAV, AIFF or FLAC for quality, or MP3, M4A or OGG for sharing.",
    ],
    can: [
      "Export exactly what you hear, with stems at their real levels.",
      "Keep exported MP3/MP4 files in your account library.",
    ],
    cant: [
      "Exporting needs the trial or a plan.",
      "M4A and OGG depend on what your browser supports.",
    ],
  },
  {
    id: "files", category: "Files & export", title: "MY COMPUTER, media library and Audio Converter",
    tags: "files my computer browser media library mp3 mp4 import audio converter formats",
    body: [
      "MY COMPUTER in the left menu opens your music files; drag them onto the timeline or an instrument.",
      "Imported and exported MP3/MP4 files are kept in your account library so you can use them on phone and computer.",
      "Audio Converter turns one audio file into another format.",
    ],
    can: [
      "Import WAV, MP3, AIFF, FLAC, M4A, OGG and video files.",
      "Skip duplicates in your library automatically.",
    ],
    cant: [
      "A browser only sees files you choose — it can't browse your whole drive by itself.",
      "Some converter formats depend on your browser.",
    ],
  },

  // ───────────── Phone & tablet ─────────────
  {
    id: "mobile", category: "Phone & tablet", title: "Using SYNCLAB on a phone",
    tags: "mobile phone android iphone sideways landscape touch rail menus scroll",
    body: [
      "SYNCLAB opens sideways on a phone. The left rail has Edit, Mix, Sounds, Tools and Files; the same menus as the computer sit at the top.",
      "Wide teal scroll bars on the right of Edit, the transport and the live panels let you scroll without touching controls.",
      "In Sounds, synths are under Synth (including Touch and Granular) and Sampler/Pad Sampler under the SAMPLERS switch.",
    ],
    can: [
      "Use the same projects, instruments and mixer as the computer.",
      "Record with the phone's microphone.",
    ],
    cant: [
      "Phones can't record other apps' sound.",
      "iPhone can't use MIDI in the browser; Android needs Chrome.",
      "Phone speakers and Bluetooth headphones add delay; use wired headphones for recording.",
    ],
  },
  {
    id: "tablet", category: "Phone & tablet", title: "Tablets",
    tags: "tablet ipad android touch",
    body: ["Tablets get the full workflow with larger touch targets."],
    can: ["Use a USB-C audio interface on a recent iPad (see “Audio interfaces on iPad and iPhone”)."],
    cant: ["Safari may ignore an interface's input because of an Apple bug."],
  },

  // ───────────── Desktop app & plugins ─────────────
  {
    id: "desktop", category: "Desktop app & plugins", title: "SYNCLAB Desktop (Mac and Windows)",
    tags: "desktop mac windows download install native offline electron",
    body: [
      "SYNCLAB Desktop runs the studio in its own window with a native menu, real Save/Open dialogs on your own drive, and a window that remembers its place.",
      "Projects are shared between web, phone and desktop.",
    ],
    can: [
      "Save and open project files directly on your computer.",
      "Capture computer audio for the samplers.",
    ],
    cant: [
      "Low-latency native audio isn't finished yet — it still uses the same audio engine as the browser.",
    ],
  },
  {
    id: "plugins", category: "Desktop app & plugins", title: "VST, AU and CLAP plugins",
    tags: "vst au vst3 clap plugin scan bridge native desktop",
    body: [
      "SYNCLAB's own instruments and effects work everywhere. The desktop app can scan your plugin folders and list what it finds.",
    ],
    can: ["List VST3, AU and CLAP plugins installed on your computer (desktop app)."],
    cant: [
      "Browsers can't run VST/AU/CLAP plugins — no web app can.",
      "The desktop app can't open or run plugins yet; it lists them and says clearly that loading is not available.",
    ],
  },

  // ───────────── Account & billing ─────────────
  {
    id: "plans", category: "Account & billing", title: "Free version, trial and plans",
    tags: "account billing trial plan price subscription paddle cancel monthly yearly",
    body: [
      "The free version lets you use the studio, but projects can't be saved.",
      "The 14-day free trial needs a card on file; cancel before day 14 and you pay nothing. Then it's $9.95/month or $119.40/year.",
      "On the website, billing, invoices and cancelling are handled by Paddle — open the upgrade panel and choose Manage billing. In the phone apps, the App Store or Google Play handles it.",
    ],
    can: [
      "Save, export and save mastered files with the trial or a plan.",
      "Cancel any time from Manage billing (website) or your store subscriptions (apps).",
    ],
    cant: [
      "Store prices and trials in the phone apps are set by Apple and Google and may differ.",
    ],
  },
  {
    id: "delete-account", category: "Account & billing", title: "Deleting your account",
    tags: "delete account remove data privacy",
    body: ["Open Settings and press “Delete my account”, then type DELETE to confirm. Your account, cloud projects, library files and subscription record are removed and you are signed out."],
    can: ["Permanently remove your account and personal data."],
    cant: [
      "It can't be undone.",
      "Deleting the account doesn't cancel a paid subscription. Cancel first in Manage billing (website) or in the App Store / Google Play.",
    ],
  },
  {
    id: "support", category: "Account & billing", title: "Getting help",
    tags: "support contact email problem bug report",
    body: ["Use Contact Support or Report a Problem in this window, or email info@synclabsapp.com."],
    can: ["Attach device details to a report (you can read them before sending)."],
    cant: ["Tickets need you to be signed in."],
  },
];
