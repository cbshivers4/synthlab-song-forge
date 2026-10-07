import * as React from "react";

const MOBILE_QUERY = "(max-width: 767px), (max-height: 500px) and (pointer: coarse)";

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
    const mql = window.matchMedia("(orientation: landscape) and (max-height: 600px) and (pointer: coarse), (orientation: landscape) and (max-height: 500px)");
    const onChange = () => setOn(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return on;
}
