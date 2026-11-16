/**
 * The one address customers are told to write to. Contact Support, Report a
 * Problem and the support settings panel all read it from here, and the
 * backend `support_settings.support_email` row is kept to the same value so
 * the app and the database never point at two different inboxes.
 */
export const SUPPORT_EMAIL = "christopherbshivers@gmail.com";
