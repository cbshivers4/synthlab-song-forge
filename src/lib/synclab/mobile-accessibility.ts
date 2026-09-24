import { useEffect, useState } from "react";

export type MobileAccessibilityPrefs = {
  extraLargeControls: boolean;
  increasedText: boolean;
  highContrast: boolean;
};

const KEY = "synclab.mobile-accessibility.v1";
export const MOBILE_PREFS_EVENT = "synclab:mobile-accessibility";
export const MOBILE_TOUR_EVENT = "synclab:mobile-tour";

export const DEFAULT_MOBILE_ACCESSIBILITY: MobileAccessibilityPrefs = {
  extraLargeControls: false,
  increasedText: false,
  highContrast: false,
};

export function readMobileAccessibility(): MobileAccessibilityPrefs {
  if (typeof window === "undefined") return DEFAULT_MOBILE_ACCESSIBILITY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_MOBILE_ACCESSIBILITY, ...(JSON.parse(raw) as Partial<MobileAccessibilityPrefs>) } : DEFAULT_MOBILE_ACCESSIBILITY;
  } catch {
    return DEFAULT_MOBILE_ACCESSIBILITY;
  }
}

export function saveMobileAccessibility(next: MobileAccessibilityPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(MOBILE_PREFS_EVENT, { detail: next }));
}

export function useMobileAccessibility() {
  const [prefs, setPrefs] = useState<MobileAccessibilityPrefs>(DEFAULT_MOBILE_ACCESSIBILITY);
  useEffect(() => {
    setPrefs(readMobileAccessibility());
    const onChange = (event: Event) => setPrefs((event as CustomEvent<MobileAccessibilityPrefs>).detail);
    window.addEventListener(MOBILE_PREFS_EVENT, onChange);
    return () => window.removeEventListener(MOBILE_PREFS_EVENT, onChange);
  }, []);
  return prefs;
}

export function replayMobileTour() {
  window.dispatchEvent(new Event(MOBILE_TOUR_EVENT));
}