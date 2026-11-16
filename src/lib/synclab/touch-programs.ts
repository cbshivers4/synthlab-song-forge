import { DRUM_KITS } from './presets';
import type { DrumKitId } from './types';

/**
 * Touch Synth sound programs, grouped the way the pocket loop-synth hardware groups its sounds.
 * Every name is an existing factory synth preset (a test checks), so the Touch Synth plays the
 * same voices as the rest of the studio and saved songs keep working.
 */
export const TOUCH_PROGRAM_GROUPS: readonly { id: string; label: string; gate?: string; programs: readonly string[] }[] = [
  { id: 'lead', label: 'LEAD', programs: ['Cybotron Lead', 'Supersaw Anthem', 'Gritty Lead', 'Square Lead', 'Whistle Lead', 'Saw Hero', 'Portamento Cry', 'Chip Lead', 'Wide Unison Lead', 'Dark Mono Lead', 'Glass Lead', 'Vocal Lead', 'Neon Saw Lead', 'Sync Scream Lead', 'Mono Glide Lead', 'Hollow Pulse Lead', 'Eastern Market Lead', 'Hoover Rave', 'Donk Lead', 'Electro Bleep', 'Talkbox Vox', 'Vocoder Bot'] },
  { id: 'acoustic', label: 'ACOUSTIC', programs: ['Concert Grand', 'Bright Pop Grand', 'Felt Piano', 'Upright Parlor Piano', 'Honky-Tonk Saloon Piano', 'Stage Tine EP', 'Rhodes Soul', 'Wurli Warm', 'Music Box Toy Piano', 'Soft Flute', 'Breathy Flute', 'Pan Flute', 'Clarinet', 'Oboe', 'Soft Sax', 'Chamber Strings', 'Pizzicato', 'Cello Section', 'Solo Violin-ish', 'Gospel Organ', 'Jazz Organ Click', 'Kalimba', 'Marimba Pluck', 'Harp Pluck', 'Pluck Nylon', 'Steel Drum-ish', 'Trumpet-ish', 'Muted Trumpet', 'Horn Section'] },
  { id: 'bass', label: 'BASS', programs: ['Sub Bass', 'Reese Bass', 'Moog Mono', '808 Sub Glide', 'Wobble Bass', 'Slap Bass', 'Upright Bass', 'Drill Slide', 'Pluck Bass', 'Round Bass', 'Distorted 808', 'FM-Style Bass', 'Analog Mono Bass', 'Punch Bass', 'Fat Unison Bass', 'Sine Thump Bass', 'Ghetto Tech Bass', 'Electro Bass 313', 'Motown Bass', 'Techno Drone Bass', '303 Acid', 'Acid Rubber', 'TD-3 Clean House Bass', 'TD-3 Clean Dub Sub', '8-Bit Bass'] },
  { id: 'chord', label: 'CHORD', programs: ['Warehouse Pad', 'Detroit Stab', 'Belleville Strings', 'Submerge Pad', 'Deep Keys', 'Juno Poly', 'Future Bass Chord', 'Dub Chord', "Kevin's Chord", "Derrick's Stab", 'Rave Stab', 'Brass Stab', 'Glass Pad', 'Vapor Pad', 'Lo-Fi Pad', 'Shimmer Pad', 'Aurora Pad', 'Synth Strings 80s', 'Poly Synth Classic Chords', 'Poly Synth Supersaw', 'SYNCE 4 Warehouse Stab', 'SYNCE 4 Muted House Stab', 'Detroit Keys', 'Clav Funk'] },
  { id: 'arp', label: 'ARP / GATE', gate: 'up', programs: ['Metro Pluck', 'Night Arp', 'Trance Arp', 'Chip Arp', 'Glass Arp', 'Berlin School', 'Plucky Arp', 'Sparkle Arp', 'Driving 16ths', 'Cascade Arp', 'Bubble Arp', 'Motor City Sequence', 'Belle Isle Pulse', 'Trance Gate', 'Acid Pluck', 'Bell Pluck', 'Dream Pluck', 'Rubber Pluck', 'Saw Pluck', 'Chime Pluck'] },
  { id: 'se', label: 'SE / FX', programs: ['Sci-Fi Sweep', 'Riser FX', 'Downlifter', 'Noise Wash', 'Siren Alarm', 'Laser Zap', 'Sub Drop', 'Atmosphere', 'Vinyl Crackle', 'Metal Hit', 'Wind', 'Space Echo', 'Data Stream', 'Glitch Burst', 'Dark Matter Drone', 'Rising Tide', 'Void Ambient', 'Assembly Line', 'Trap Bell', 'FM Bell', 'Belleville Bells', 'Bell Toy'] },
];

/** Arp/gate sounds default to a gate rhythm so holding a finger plays a pattern straight away. */
export const ARP_PROGRAM_GATES: Record<string, string> = {
  'Metro Pluck': 'gate16', 'Night Arp': 'up', 'Trance Arp': 'trance', 'Chip Arp': 'updown', 'Glass Arp': 'broken', 'Berlin School': 'acid',
  'Plucky Arp': 'gallop', 'Sparkle Arp': 'octave', 'Driving 16ths': 'gate16', 'Cascade Arp': 'down', 'Bubble Arp': 'stutter',
  'Motor City Sequence': 'acid', 'Belle Isle Pulse': 'offbeat', 'Trance Gate': 'trance', 'Acid Pluck': 'acid', 'Bell Pluck': 'dotted',
  'Dream Pluck': 'broken', 'Rubber Pluck': 'gallop', 'Saw Pluck': 'chord', 'Chime Pluck': 'climb',
};

export const TOUCH_KIT_PROGRAMS: readonly { id: DrumKitId; name: string; category: string }[] = DRUM_KITS.map((k) => ({ id: k.id, name: k.name, category: k.category }));
export const kitName = (id?: string) => TOUCH_KIT_PROGRAMS.find((k) => k.id === id)?.name ?? 'TR-909';

export const ALL_TOUCH_PROGRAMS = TOUCH_PROGRAM_GROUPS.flatMap((g) => g.programs);
/** Group a sound belongs to; older songs with a sound outside the list still show under its own name. */
export const programGroupOf = (name: string) => TOUCH_PROGRAM_GROUPS.find((g) => g.programs.includes(name));
