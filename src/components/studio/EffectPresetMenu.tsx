import type { PluginInstance } from "@/lib/synclab/types";
import { currentEffectPreset, effectPresets, effectPresetParams } from "@/lib/synclab/effect-presets";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function EffectPresetMenu({ plugin, onParam }: { plugin: PluginInstance; onParam: (id: string, value: number) => void }) {
  const selected = currentEffectPreset(plugin);
  return <div className="fx-preset-strip">
    <Select value={selected?.id ?? "custom"} onValueChange={id => {
      const params = effectPresetParams(plugin, id);
      if (!params) return;
      for (const param of params) onParam(param.id, param.value);
    }}>
      <SelectTrigger className="fx-preset-window" aria-label={`${plugin.name} presets`}>
        <span className="fx-preset-caption">PRESET</span><SelectValue placeholder="Custom" />
      </SelectTrigger>
      <SelectContent className="fx-preset-options">
        {!selected && <SelectItem value="custom" disabled>Custom</SelectItem>}
        {effectPresets(plugin).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}