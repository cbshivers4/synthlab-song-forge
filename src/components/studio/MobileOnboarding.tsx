import { useEffect, useState } from "react";
import { Accessibility, Home, Mic, Plus, SlidersHorizontal, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MOBILE_TOUR_EVENT } from "@/lib/synclab/mobile-accessibility";

const KEY = "synclab.mobile-tour.v1";
const steps = [
  {
    title: "Made for your hands",
    body: "Phone controls are larger and spaced apart. You can make them even bigger in Settings → Mobile.",
    icon: <Accessibility className="size-10" />,
  },
  {
    title: "Five controls, one studio",
    body: "HOME returns to your tracks. CREATE opens sounds and instruments. RECORD captures a take. MIX opens channels. MORE holds editors, Settings, and Help.",
    icon: (
      <div className="flex items-center gap-3 text-primary">
        <Home />
        <Plus />
        <Mic />
        <SlidersHorizontal />
        <MoreHorizontal />
      </div>
    ),
  },
  {
    title: "Fast track gestures",
    body: "Tap a track to select it. Hold for actions. Swipe right to mute, left to solo, up to move it up, or down to move it down.",
    icon: <SlidersHorizontal className="size-10" />,
  },
] as const;

export function MobileOnboarding({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const show = () => {
      setStep(0);
      setOpen(true);
    };
    const consider = () => {
      try {
        if (window.localStorage.getItem(KEY) === "1") return;
      } catch {
        /* storage unavailable */
      }
      if (document.querySelector('[role="dialog"]')) {
        timer = window.setTimeout(consider, 900);
        return;
      }
      show();
    };
    timer = window.setTimeout(consider, 900);
    window.addEventListener(MOBILE_TOUR_EVENT, show);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(MOBILE_TOUR_EVENT, show);
    };
  }, [enabled]);
  const close = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable */
    }
    setOpen(false);
  };
  const current = steps[step];
  if (!current) return null;
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-lg p-5">
        <DialogHeader className="text-left">
          <div className="mb-2 text-primary">{current.icon}</div>
          <DialogTitle className="pr-8 text-2xl">{current.title}</DialogTitle>
          <DialogDescription className="pt-2 text-base leading-relaxed text-foreground">
            {current.body}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 pt-2">
          <Button variant="ghost" className="h-12" onClick={close}>
            Skip
          </Button>
          <span className="ml-auto font-mono text-sm text-muted-foreground">
            {step + 1} / {steps.length}
          </span>
          {step > 0 && (
            <Button
              variant="secondary"
              className="h-12"
              onClick={() => setStep((value) => value - 1)}
            >
              Back
            </Button>
          )}
          <Button
            className="h-12 min-w-24"
            onClick={() => (step === steps.length - 1 ? close() : setStep((value) => value + 1))}
          >
            {step === steps.length - 1 ? "Done" : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
