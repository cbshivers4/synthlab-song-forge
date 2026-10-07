import * as React from "react";

const LANDSCAPE_PHONE_QUERY = "(orientation: landscape) and (max-width: 1100px) and (max-height: 600px) and (pointer: coarse), (orientation: landscape) and (max-width: 1100px) and (max-height: 550px)";
const MOBILE_QUERY = `(max-width: 767px), ${LANDSCAPE_PHONE_QUERY}`;

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

/** Phone held sideways: switches the phone layout to production/edit mode. */
export function useIsLandscapePhone() {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia(LANDSCAPE_PHONE_QUERY);
    const onChange = () => setOn(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return on;
}
