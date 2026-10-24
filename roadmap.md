# Roadmap — Source-code audit & DAW repair

- [ ] Expand Modular Tech with six working devices, distinct hardware faces, connected demo racks, and audio/phone/desktop checks.

- [x] Reference-led effects: segmented graphite, silver/red and vintage faceplates; mixed Eurorack modules and scoped rails/jacks; phone/desktop rack checked with 7 modules/4 cables and knob change 0→1; 7 related tests pass.

- [x] Shared distinct hardware effect finishes in rack and mixer editors; phone timeline/mixer menus opened by single touch with 44px targets and light panels; compressor editor checked on phone/desktop, 7 related tests pass.

- [x] Phone Edit and left navigation: whole-page timeline and independent rail scrolling; touch swipes verified in both directions on upright-held phones, landscape Edit checked.

- [x] SYNCPADS: verified unused Banks B–H empty; sound/sample adding and single/multiple-pad deletion preserve other banks and empty-bank recall on desktop/phone.

- [x] SYNCPADS: pad/envelope MIDI Learn and readable envelope labels; simulated MIDI verified learning is silent, note press plays once, release adds no hit, and CC updates both Attack controls.

- [x] Drum Machine: Banks A-H, empty unused banks, selectable sound and multi-file sample pads; bank round-trip tests and browser add/recall verified; cloud drum asset upload/restore included.

- [x] Audit audio signal path (instruments → track → inserts → buses → mixer → master)
- [x] Audit recording & MIDI (mic capture, MIDI notes, drum/sampler pads, overdub, reopen)
- [x] Audit arrangement editor (clips, drag/trim/split, undo, persistence)
- [x] Audit unfinished features — all real implementations, labels honest
- [x] Restore test command (`npm test`) — 130/130 pass
- [x] Stage 1: synth FX bypass mute/volume; capture misses live master FX; decode-after-Stop
- [x] Stage 2: sampler-pad recording routed to mic; desktop drum taps write no hits; Save during recording loses take; rate-aware clip trimming
- [x] Upright-phone pointer fix: canvas-point helper maps rotated touch coords across knobs, timeline, piano roll, mixer, XY pads, drum roll, sampler, EQ — verified playhead tap works
- [ ] Stage 3 (needs runtime verification): Stop can detach live mic monitoring; overdub can re-capture existing printed material; undo debounce gaps; cold-start master gain; metronome clicks after Stop
