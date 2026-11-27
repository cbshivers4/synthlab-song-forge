import { Pause, Play, Square, Circle, SkipBack, Repeat, Timer, Undo2, Redo2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { usePlayStep } from "@/lib/synclab/playhead";
import { recordingPosition } from "@/lib/synclab/recording-display";

/** One playback dock, backed by the same transport as the arrangement and instruments. */
export function PhonePlayback({ onOptions }: { onOptions: () => void }) {
  const { transport, togglePlay, toggleRecord, stop, setTransport, undo, redo, canUndo, canRedo } = useStudio();
  return (
    <footer className="phone-playback-dock" aria-label="Song playback" data-keep-timeline-selection>
      <div className="phone-playback-controls">
        <Button variant={transport.recording ? "destructive" : "ghost"} size="icon" aria-label={transport.recording ? "Stop song recording" : "Record song"} aria-pressed={transport.recording} onClick={toggleRecord}><Circle className="size-5 fill-current text-destructive" /></Button>
        <Button variant={transport.playing ? "secondary" : "ghost"} size="icon" aria-label={transport.playing ? "Pause song" : "Play song"} onClick={togglePlay}>{transport.playing ? <Pause /> : <Play />}</Button>
        <Button variant="ghost" size="icon" aria-label="Stop song" onClick={() => void stop()}><Square className="size-5" /></Button>
        <Button variant="ghost" size="icon" aria-label="Return to start" onClick={() => setTransport({ step: transport.loop ? transport.loopStart ?? 0 : 0 })}><SkipBack /></Button>
        <Button variant={transport.loop ? "secondary" : "ghost"} size="icon" aria-label="Loop song" aria-pressed={transport.loop} onClick={() => setTransport({ loop: !transport.loop })}><Repeat /></Button>
      </div>
      <PhonePosition />
      <Button variant={transport.metronome ? "secondary" : "ghost"} className="phone-tempo-button" aria-label="Tempo and recording options" onClick={onOptions}>
        <Timer className="size-5" /><span><strong>{transport.bpm} BPM</strong><small>{transport.beatsPerBar ?? 4}/4</small></span>
      </Button>
      <div className="phone-playback-controls phone-history-controls">
        <Button variant="ghost" size="icon" aria-label="Undo edit" disabled={!canUndo} onClick={undo}><Undo2 /></Button>
        <Button variant="ghost" size="icon" aria-label="Redo edit" disabled={!canRedo} onClick={redo}><Redo2 /></Button>
        <Button variant="ghost" size="icon" aria-label="More transport options" onClick={onOptions}><Settings2 /></Button>
      </div>
    </footer>
  );
}

function PhonePosition() {
  const { transport } = useStudio();
  const position = recordingPosition(usePlayStep(), transport.beatsPerBar ?? 4);
  return <div className="phone-song-position" aria-label="Song position"><strong>{position.bar}:{position.beat}</strong><small>BAR · BEAT</small></div>;
}