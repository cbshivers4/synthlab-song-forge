import * as React from "react";

const LANDSCAPE_PHONE_QUERY =
  "(orientation: landscape) and (max-width: 1100px) and (max-height: 600px) and (pointer: coarse), (orientation: landscape) and (max-width: 1100px) and (max-height: 550px)";
const MOBILE_QUERY = `(max-width: 767px), (pointer: coarse) and (max-width: 1024px), ${LANDSCAPE_PHONE_QUERY}`;
const PHONE_WORKSPACE_QUERY = `${LANDSCAPE_PHONE_QUERY}, (orientation: portrait) and (max-width: 767px) and (pointer: coarse), (orientation: portrait) and (max-width: 600px)`;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/** Phone workspace is sideways even when the browser's physical viewport is upright. */
export function useIsLandscapePhone() {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia(PHONE_WORKSPACE_QUERY);
    const onChange = () => setOn(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return on;
}

/** Synchronous phone check (phone, tablet touch or sideways phone canvas) for UI that only renders after a tap. */
export function phoneLayoutNow(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia(MOBILE_QUERY).matches || window.matchMedia(PHONE_WORKSPACE_QUERY).matches
  );
}
