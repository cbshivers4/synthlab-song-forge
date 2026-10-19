import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SHORTCUTS } from "@/lib/synclab/shortcuts";

export function KeyboardShortcuts() {
  const [search, setSearch] = useState("");
  const matches = SHORTCUTS.filter((s) => `${s.keys} ${s.group} ${s.description}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="min-w-0 space-y-4">
    <h3 className="text-base font-semibold">Keyboard shortcuts</h3>
    <p className="text-sm text-muted-foreground">Mod = Ctrl on Windows or Command on Mac. Alt = Option on Mac. Shortcuts pause while typing in fields or using menus and dialogs. On phones, connect a physical keyboard.</p>
    <Input aria-label="Search keyboard shortcuts" placeholder="Search actions or keys…" value={search} onChange={(e) => setSearch(e.target.value)} />
    {[...new Set(matches.map((s) => s.group))].map((group) => <div key={group}>
      <h4 className="border-b border-border py-2 text-sm font-semibold text-primary">{group}</h4>
      {group === "Single-key alternatives" && <p className="py-2 text-xs text-muted-foreground">When computer-keyboard notes are enabled, note keys take priority. Use the Alt shortcuts above instead.</p>}
      {matches.filter((s) => s.group === group).map((s) => <div key={`${s.id}-${s.keys}`} className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 border-b border-border/50 py-2.5 sm:grid-cols-[168px_minmax(0,1fr)]">
        <kbd className="self-start break-words font-mono text-xs text-foreground">{s.keys}</kbd><span className="min-w-0 text-sm text-muted-foreground">{s.description}</span>
      </div>)}
    </div>)}
    {!matches.length && <p className="text-sm text-muted-foreground">No matching shortcuts.</p>}
    <div className="border-t border-border pt-3 text-sm text-muted-foreground"><h4 className="mb-2 font-semibold text-primary">Computer keyboard notes</h4><p>A W S E D F T G Y H U J K O L play chromatic notes on the armed or selected instrument. Z / X lower / raise the octave. Alt + K toggles note playing; configure it in Other controls.</p></div>
  </section>;
}