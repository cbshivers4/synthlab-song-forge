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
  publisher: "Christopher Shivers",
  copyright: `Copyright © ${new Date().getFullYear()} Christopher Shivers`,
  website: "https://synclab-app.lovable.app/",
  supportUrl: "https://synclab-app.lovable.app/",
  privacyUrl: "https://synclab-app.lovable.app/privacy",
  termsUrl: "https://synclab-app.lovable.app/terms",
};
