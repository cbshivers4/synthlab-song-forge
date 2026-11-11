import { AudioLines, Mic, MonitorSpeaker, Unplug } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openInOwnTab } from "@/lib/synclab/mic";
import {
  connectSystemAudio,
  deviceSystemSupport,
  disconnectSystemAudio,
  setSampleSource,
  SOURCE_LABEL,
  useSampleSource,
  type SampleSource,
  type Support,
} from "@/lib/synclab/sample-sources";

const ICONS: Record<SampleSource, typeof Mic> = { mic: Mic, system: MonitorSpeaker, studio: AudioLines };

/** Shared "record from" switch for the Sampler and Pad Sampler (Koala-style sample anything). */
export function SampleSourcePicker({ disabled = false }: { disabled?: boolean }) {
  const { source: chosen, connected, label } = useSampleSource();
  // Device support is read after hydration so server and browser render the same markup.
  const [support, setSupport] = useState<Support | null>(null);
  useEffect(() => setSupport(deviceSystemSupport()), []);
  const systemBlocked = support !== null && !support.ok;
  // A saved "Computer sound" choice falls back to the mic on devices that can't share it.
  const source: SampleSource = chosen === "system" && systemBlocked ? "mic" : chosen;

  const connect = async () => {
    const res = await connectSystemAudio();
    if (res.ok) toast.success("Computer sound connected", { description: "Anything playing there can now be recorded. Press Disconnect, or Stop sharing in the browser, when you're done." });
    else toast.error("Computer sound not connected", { description: res.error, duration: 10000, ...(res.canOpenTab ? { action: { label: "Open in tab", onClick: openInOwnTab } } : {}) });
  };

  return (
    <div className="space-y-1.5 rounded-md border border-border bg-surface-2/40 p-2" role="group" aria-label="Record from">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label-xs mr-1">RECORD FROM</span>
        {(["mic", "system", "studio"] as const).map((s) => {
          const I = ICONS[s];
          const off = s === "system" && systemBlocked;
          return (
            <Button
              key={s}
              size="sm"
              variant={source === s ? "secondary" : "ghost"}
              aria-pressed={source === s}
              disabled={disabled}
              className={`h-9 gap-1.5 sm:h-7 ${off ? "opacity-60" : ""}`}
              title={off && support && !support.ok ? support.reason : undefined}
              onClick={() => {
                if (off && support && !support.ok) { toast.info("Computer sound isn't available here", { description: support.reason, duration: 10000 }); return; }
                setSampleSource(s);
              }}
            >
              <I className="size-3.5" /> {SOURCE_LABEL[s]}
            </Button>
          );
        })}
        {source === "system" && !systemBlocked && (
          connected ? (
            <Button size="sm" variant="ghost" className="ml-auto h-9 gap-1.5 sm:h-7" onClick={disconnectSystemAudio}>
              <Unplug className="size-3.5" /> Disconnect
            </Button>
          ) : (
            <Button size="sm" className="ml-auto h-9 gap-1.5 sm:h-7" disabled={disabled} onClick={() => void connect()}>
              <MonitorSpeaker className="size-3.5" /> Connect computer sound
            </Button>
          )
        )}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground" aria-live="polite">
        {source === "mic" && "Records your microphone or audio interface."}
        {source === "studio" && "Records everything SYNCLAB is playing right now — beats, synths, decks — so you can resample it. Works on phones too."}
        {source === "system" && (support === null ? "" : !support.ok ? support.reason : connected
          ? `Connected: ${label}. Play something on your computer, then record.`
          : `Records sound from YouTube, Spotify or any app on this computer. ${support.tip}`)}
      </p>
    </div>
  );
}
