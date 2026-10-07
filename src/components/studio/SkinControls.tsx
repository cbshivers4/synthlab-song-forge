import { useEffect, useRef, useState } from "react";
import { Crop, ImagePlus, Palette, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  applyPreset,
  clearPanelWallpaper,
  deletePreset,
  imageToDataUrl,
  savePreset,
  setSkin,
  startSkinSync,
  usePresets,
  useSkin,
  type Skin,
  type SkinKey,
} from "@/lib/synclab/skins";

type Props = { skinKey: SkinKey; image?: boolean; padColor?: boolean; colorLabel?: string };

const safe = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    toast.error((e as Error).message);
  }
};

function ThemePresets() {
  const presets = usePresets();
  const [sel, setSel] = useState<string>("");
  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 sm:flex sm:w-auto sm:flex-wrap">
      <Select
        value={sel}
        onValueChange={(v) => {
          setSel(v);
          safe(() => applyPreset(v));
        }}
      >
        <SelectTrigger className="h-8 w-full min-w-0 sm:w-36 [&>span]:truncate" aria-label="Saved themes">
          <SelectValue placeholder={presets.length ? "Themes" : "No themes yet"} />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        title="Save studio panel colors and pictures as a theme"
        onClick={() => {
          const name = window.prompt("Name this theme");
          if (name === null) return;
          safe(() => savePreset(name));
          toast.success("Theme saved");
        }}
      >
        <Save className="size-4" /> Save theme
      </Button>
      {sel && (
        <Button
          size="sm"
          variant="ghost"
          title="Delete selected theme"
          aria-label="Delete selected theme"
          onClick={() => {
            safe(() => deletePreset(sel));
            setSel("");
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
      {presets.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" title="Manage saved themes">
              <Trash2 className="size-4" /> Themes
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-1">
            <p className="pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Saved themes
            </p>
            {presets.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded px-1 py-0.5">
                <span className="truncate text-sm">{p.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete theme ${p.name}`}
                  onClick={() => {
                    safe(() => deletePreset(p.id));
                    if (sel === p.id) setSel("");
                    toast.success("Theme deleted");
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function ImageFraming({ skinKey, skin }: { skinKey: SkinKey; skin: Skin }) {
  const row = (label: string, value: number, min: number, max: number, step: number, key: keyof Skin) => (
    <div className="space-y-1.5">
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span>{key === "imageZoom" ? `${value.toFixed(2)}×` : `${Math.round(value)}%`}</span>
      </div>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => safe(() => setSkin(skinKey, { [key]: v }))}
      />
    </div>
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Crop className="size-4" /> Frame
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-4">
        {row("Zoom / crop", skin.imageZoom ?? 1, 1, 4, 0.05, "imageZoom")}
        {row("Left ↔ Right", skin.imageX ?? 50, 0, 100, 1, "imageX")}
        {row("Up ↕ Down", skin.imageY ?? 50, 0, 100, 1, "imageY")}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Darken over picture</span>
            <span>{Math.round(((skin.dim ?? 0.35) / 0.8) * 100)}%</span>
          </div>
          <Slider
            aria-label="Darken over picture"
            min={0}
            max={0.8}
            step={0.05}
            value={[skin.dim ?? 0.35]}
            onValueChange={([v]) => safe(() => setSkin(skinKey, { dim: v }))}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: drag the picture around the pads to move it, or drop a JPEG straight onto the panel.
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => safe(() => setSkin(skinKey, { imageZoom: 1, imageX: 50, imageY: 50 }))}
        >
          <RotateCcw className="size-4" /> Reset framing
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function SkinControls({ skinKey, image, padColor, colorLabel = "Background" }: Props) {
  const skin = useSkin(skinKey);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => startSkinSync(), []);
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2/40 px-2 py-1.5 [&>label]:shrink-0 [&>button]:shrink-0">
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
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                setSkin(skinKey, { image: await imageToDataUrl(f), imageZoom: 1, imageX: 50, imageY: 50 });
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            title="Use a JPEG, PNG or WEBP from your computer as this panel's wallpaper"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" /> Wallpaper
          </Button>
          {skin.image && <ImageFraming skinKey={skinKey} skin={skin} />}
        </>
      )}
      <Button
        size="sm"
        variant="ghost"
        title="Remove this panel's picture and colors"
        onClick={() =>
          safe(() => {
            setSkin(skinKey, { color: undefined, padColor: undefined });
            clearPanelWallpaper(skinKey);
          })
        }
      >
        <RotateCcw className="size-4" /> Reset
      </Button>
      <ThemePresets />
    </div>
  );
}

export function skinBackground(skin: Skin): React.CSSProperties | undefined {
  if (skin.image) {
    const d = skin.dim ?? 0.35;
    return {
      backgroundImage: `linear-gradient(hsl(0 0% 0% / ${d}), hsl(0 0% 0% / ${d})), url(${skin.image})`,
      backgroundSize: `cover, ${(skin.imageZoom ?? 1) * 100}% auto`,
      backgroundPosition: `center, ${skin.imageX ?? 50}% ${skin.imageY ?? 50}%`,
      backgroundRepeat: "no-repeat",
      backgroundColor: skin.color,
    };
  }
  if (skin.color) return { backgroundColor: skin.color };
  return undefined;
}

/** Drag on empty space around the pads to reposition the picture. */
export function useImageDrag(skinKey: SkinKey, skin: Skin) {
  const drag = useRef<{ x: number; y: number; ix: number; iy: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (!skin.image || e.target !== e.currentTarget) return;
      drag.current = { x: e.clientX, y: e.clientY, ix: skin.imageX ?? 50, iy: skin.imageY ?? 50 };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      const r = e.currentTarget.getBoundingClientRect();
      const clamp = (v: number) => Math.max(0, Math.min(100, v));
      safe(() =>
        setSkin(skinKey, {
          imageX: clamp(d.ix - ((e.clientX - d.x) / r.width) * 100),
          imageY: clamp(d.iy - ((e.clientY - d.y) / r.height) * 100),
        }),
      );
    },
    onPointerUp: () => {
      drag.current = null;
    },
  };
}

/** Drop a picture file from your computer onto a panel to make it that panel's wallpaper. */
export function useImageDrop(skinKey: SkinKey) {
  return {
    onDragOver: (e: React.DragEvent<HTMLElement>) => {
      if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDrop: async (e: React.DragEvent<HTMLElement>) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f || !/^image\/(jpeg|jpg|png|webp)$/i.test(f.type)) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        setSkin(skinKey, { image: await imageToDataUrl(f), imageZoom: 1, imageX: 50, imageY: 50 });
        toast.success("Wallpaper set");
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
  };
}
