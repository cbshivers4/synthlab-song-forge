# Roadmap — Source-code audit & DAW repair

- [x] Audit audio signal path — fixed: synth FX bypass mute, capture misses live master FX, decode-after-Stop
- [ ] Fix sampler-pad recording routing (captures mic instead of pad)
- [ ] Audit recording & MIDI (mic capture, MIDI notes, drum/sampler pads, overdub, reopen)
- [ ] Audit arrangement editor (clips, drag/trim/split, undo, persistence)
- [ ] Verify desktop vs phone layouts stay separate
- [ ] Audit unfinished features (Co-Producer, stems, Hum to Beat, mastering, looper, reel, video sampler) — honest labels only
- [ ] Run existing unit tests, restore test command if missing
- [ ] Deliver audit report, then fix in small tested stages
