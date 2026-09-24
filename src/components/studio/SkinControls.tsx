import { useRef } from "react";
import { ImagePlus, Palette, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { imageToDataUrl, setSkin, useSkin } from "@/lib/synclab/skins";

type Props = { skinKey: "sampler" | "drums" | "synth"; image?: boolean; padColor?: boolean; colorLabel?: string };

export function SkinControls({ skinKey, image, padColor, colorLabel = "Background" }: Props) {
  const skin = useSkin(skinKey);
  const fileRef = useRef<HTMLInputElement>(null);
  const safe = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2/40 px-2 py-1.5">
      <Palette className="size-4 text-primary" />
      <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {colorLabel}
        <input
          type="color"
          aria-label={`${colorLabel} color`}
          value={skin.color ?? "#1a1d24"}
          onChange={(e) => safe(() => setSkin(skinKey, { color: e.target.value }))}
          className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
        />
      </label>
      {padColor && (
        <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Pads
          <input
            type="color"
            aria-label="Recorded pad color"
            value={skin.padColor ?? "#22d3ee"}
            onChange={(e) => safe(() => setSkin(skinKey, { padColor: e.target.value }))}
            className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
          />
        </label>
      )}
      {image && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                setSkin(skinKey, { image: await imageToDataUrl(f) });
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4" /> Picture
          </Button>
        </>
      )}
      <Button
        size="sm"
        variant="ghost"
        title="Reset colors and picture"
        onClick={() => safe(() => setSkin(skinKey, { color: undefined, padColor: undefined, image: undefined }))}
      >
        <RotateCcw className="size-4" /> Reset
      </Button>
    </div>
  );
}

export function skinBackground(skin: { color?: string; image?: string }): React.CSSProperties | undefined {
  if (skin.image)
    return {
      backgroundImage: `linear-gradient(hsl(0 0% 0% / 0.35), hsl(0 0% 0% / 0.35)), url(${skin.image})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  if (skin.color) return { backgroundColor: skin.color };
  return undefined;
}
