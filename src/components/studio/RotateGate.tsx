import { useEffect } from "react";

/** Physical orientation remains browser-controlled; CSS supplies a sideways canvas. */
export function PhoneOrientation() {
  useEffect(() => {
    document.documentElement.classList.add("phone-sideways-default");
    return () => document.documentElement.classList.remove("phone-sideways-default");
  }, []);
  return null;
}
