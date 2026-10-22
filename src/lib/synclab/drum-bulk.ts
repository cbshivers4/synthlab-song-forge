import type { DrumPad } from './types';

export type DrumHitField = 'steps' | 'stepPitch' | 'stepDecay' | 'probability' | 'flam' | 'retrig' | 'glitch';
export type DrumBulkEdit = { scope: 'sounds'; patch: Partial<DrumPad> } | { scope: 'hits'; field: DrumHitField; value: number } | { scope: 'shift'; amount: number };
const hitFields: DrumHitField[] = ['steps', 'stepPitch', 'stepDecay', 'probability', 'flam', 'retrig', 'glitch'];
const fallback = (field: DrumHitField) => ['stepDecay', 'probability', 'retrig'].includes(field) ? 1 : 0;

/** Selected-instrument editing never touches another pad or creates an empty hit. */
export function editInstrumentNotes(pads: DrumPad[], padId: string, field: DrumHitField, value: number, scope: 'one' | 'all', step: number, region?: [number, number]): DrumPad[] {
  return pads.map(pad => {
    if (pad.id !== padId) return pad;
    if (scope === 'all') return editDrumPads([pad], { scope: 'hits', field, value }, region)[0] ?? pad;
    const count = pad.steps.length;
    const first = step + Math.max(0, Math.ceil(((region?.[0] ?? 0) - step) / Math.max(1, count))) * count;
    if (step < 0 || step >= count || (pad.steps[step] ?? 0) <= 0 || (region && first >= region[1])) return pad;
    const values = Array.from({ length: count }, (_, i) => pad[field]?.[i] ?? fallback(field));
    values[step] = value;
    return { ...pad, [field]: values };
  });
}

/** Bulk edits affect existing hits only; an active loop limits editable pattern positions. */
export function editDrumPads(pads: DrumPad[], edit: DrumBulkEdit, region?: [number, number]): DrumPad[] {
  return pads.map(pad => {
    if (edit.scope === 'sounds') return { ...pad, ...edit.patch, id: pad.id, steps: pad.steps };
    const count = pad.steps.length;
    const indices = Array.from({ length: count }, (_, i) => i).filter(i => {
      if (!region) return true;
      const first = i + Math.max(0, Math.ceil((region[0] - i) / Math.max(1, count))) * count;
      return first < region[1];
    });
    if (edit.scope === 'hits') {
      const values = Array.from({ length: count }, (_, i) => pad[edit.field]?.[i] ?? fallback(edit.field));
      for (const i of indices) if ((pad.steps[i] ?? 0) > 0) values[i] = edit.value;
      return { ...pad, [edit.field]: values };
    }
    if (!indices.length) return pad;
    const next = { ...pad };
    for (const field of hitFields) {
      if (field !== 'steps' && !pad[field]) continue;
      const source = Array.from({ length: count }, (_, i) => pad[field]?.[i] ?? fallback(field));
      const values = source.slice();
      indices.forEach((from, index) => {
        const to = indices[((index + edit.amount) % indices.length + indices.length) % indices.length];
        if (to !== undefined) values[to] = source[from] ?? fallback(field);
      });
      next[field] = values;
    }
    return next;
  });
}