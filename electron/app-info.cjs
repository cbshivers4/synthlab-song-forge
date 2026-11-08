/**
 * Single source of desktop application identity. The build script and the main
 * process both read this file, so name, id and version cannot drift apart.
 */
module.exports = {
  productName: "SYNCLAB",
  appId: "com.synclab.vocalforge",
  version: "1.0.0",
  tagline: "CREATE. RECORD. PRODUCE. FINISH.",
  description: "SYNCLAB — record, produce and finish music.",
  publisher: "SYNCLAB",
  copyright: `Copyright © ${new Date().getFullYear()} SYNCLAB`,
  website: "https://synclabsapp.com/",
  supportUrl: "https://synclabsapp.com/",
  privacyUrl: "https://synclabsapp.com/privacy",
  termsUrl: "https://synclabsapp.com/terms",
};
