import { useEffect } from "react";
import { installSidewaysPopupScroll } from "@/lib/synclab/sideways-scroll";

/** Physical orientation remains browser-controlled; CSS supplies a sideways canvas. */
export function PhoneOrientation() {
  useEffect(() => {
    document.documentElement.classList.add("phone-sideways-default");
    const releaseScroll = installSidewaysPopupScroll();
    return () => {
      releaseScroll();
      document.documentElement.classList.remove("phone-sideways-default");
    };
  }, []);
  return null;
}
