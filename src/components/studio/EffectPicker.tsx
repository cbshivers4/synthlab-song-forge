import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { effectBrand, groupByCategory } from "@/lib/synclab/effect-catalog";
import type { PluginDef } from "@/lib/synclab/types";

export function EffectPicker({ effects, onAdd }: { effects: PluginDef[]; onAdd: (def: PluginDef) => void }) {
  return <div className="max-h-72 space-y-2 overflow-y-auto" aria-label="All effects">
    {groupByCategory(effects).map(([category, defs]) => <div key={category} role="group" aria-label={category}>
      <div className="sticky top-0 bg-popover py-1 font-mono text-[10px] text-muted-foreground">{category}</div>
      {defs.map(def => <Button key={def.id} variant="ghost" className="h-auto min-h-11 w-full flex-col items-start gap-0 whitespace-normal px-2 text-left" aria-label={`Add ${def.name}`} onClick={() => onAdd(def)}>
        <span className="text-xs">{effectBrand(def)}</span><span className="font-mono text-[9px] text-muted-foreground">{def.name}</span>
      </Button>)}
    </div>)}
  </div>;
}

export function EffectMenuItems({ effects, onAdd }: { effects: PluginDef[]; onAdd: (def: PluginDef) => void }) {
  return <DropdownMenuSub><DropdownMenuSubTrigger>Add effect</DropdownMenuSubTrigger><DropdownMenuSubContent className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-72 overflow-y-auto">
    {groupByCategory(effects).map(([category, defs]) => <div key={category} role="group" aria-label={category}>
      <div className="px-2 py-2 font-mono text-[10px] text-muted-foreground">{category}</div>
      {defs.map(def => <DropdownMenuItem key={def.id} className="min-h-11 flex-col items-start gap-0" onSelect={event => { event.stopPropagation(); onAdd(def); }}>
        <span>{effectBrand(def)}</span><span className="font-mono text-[9px] text-muted-foreground">{def.name}</span>
      </DropdownMenuItem>)}
    </div>)}
  </DropdownMenuSubContent></DropdownMenuSub>;
}