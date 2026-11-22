/** Browser helpers shared by the founder pop-ups, dashboard and studio buttons. */

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Opens the founder dashboard in a new tab, so an unsaved song in the studio stays open. */
export function openFounderDashboard(tab?: string) {
  window.open(tab ? `/admin?tab=${tab}` : "/admin", "_blank", "noopener");
}
