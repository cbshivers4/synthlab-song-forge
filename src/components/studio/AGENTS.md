# Studio components

SynthEditor derives instrument tabs from timeline track IDs and selects through the shared store; keep each track's editor keyed by its ID so switching preserves project patches without leaking local controls between synths.

Effects Rack reuses track plugin instances and store actions with inline RackEffect modules; post-insert analyser scopes and shared 20 fps meter callbacks keep the rack tied to real audio without changing routing.

Timeline cutting uses a pointer overlay with a visible tool icon and exact-position guide; update pointer visuals through DOM refs to avoid rapid React/audio updates and keep clip drag handles from intercepting cuts.

Studio View keeps base furnishings independent of project tracks, derives instruments/microphones and racks from tracks/inserts, opens existing editors, and reads real levels through one 20 fps DOM timer; no duplicate project/audio state keeps it synchronized.
