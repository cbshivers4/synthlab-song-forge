/**
 * Single source of desktop application identity. The build script and the main
 * process both read this file, so name, id and version cannot drift apart.
 */
module.exports = {
  productName: "SYNCLAB Vocal Forge",
  appId: "com.synclab.vocalforge",
  version: "1.0.0",
  tagline: "CREATE. RECORD. PRODUCE. FINISH.",
  description: "SYNCLAB Vocal Forge — record, produce and finish music.",
  publisher: "Christopher Shivers",
  copyright: `Copyright © ${new Date().getFullYear()} Christopher Shivers`,
  website: "https://synthlab-song-forge.lovable.app/",
  supportUrl: "https://synthlab-song-forge.lovable.app/",
  privacyUrl: "https://synthlab-song-forge.lovable.app/privacy",
  termsUrl: "https://synthlab-song-forge.lovable.app/terms",
};
