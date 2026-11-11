# 03: Release hygiene: licenses, release cert, no .debug, version

**What to build:** The things every public build needs, whatever the channel.

- **Licenses.** Add a `LICENSE` for the project and a `THIRD_PARTY_NOTICES` file shipped inside the extension: the Focus-Points Lr plugin is Apache 2.0 (we ported its Fuji geometry, so attribution and its license text are required); exiftool is redistributable with its notice. digiKam is GPL — it stays a cross-reference only and no code is copied from it.
- **Release certificate.** A new private signing cert for releases, separate from the dev `tools/cert.p12` (whose password `bfp-dev-pass` is in a committed script). It never enters the repo; ticket 05 reads it from GitHub secrets. Release signing uses a timestamp server (`ZXPSignCmd -sign … -tsa <url>`) so installed copies keep working after the cert expires.
- **No `.debug` in release builds.** It opens remote-debug port 8088 on users' machines. Dev installs keep it.
- **One version number.** `ExtensionBundleVersion` / `Extension Version` in `CSXS/manifest.xml` come from a single source the release build can stamp (the git tag), and the panel can read at runtime (for ticket 06).
- **README** for users: what it does, supported cameras, install, the SmartScreen note, how updates work.

**Blocked by:** —

**Status:** ready-for-human

- [x] `LICENSE` and `THIRD_PARTY_NOTICES` exist; the notices file is in the staged extension
- [ ] A release build (script or flag) produces a timestamped `.zxp` without `.debug`, signed with a cert passed in by environment variable, not a committed default
- [x] Version stamped into the manifest from one place; panel can read it
- [ ] Dev `sign-install.sh` behaves exactly as before
- [x] README covers install, update and SmartScreen

## Comments

2026-11-11, from the wide-camera-support work: `THIRD_PARTY_NOTICES` now has more Focus-Points Lr plugin material to cover than the Fuji geometry. Ported from it (Apache 2.0, each file carries an attribution header): `client/delegates/sony.js`, `nikon.js`, `canon.js`, `olympus.js`, `common.js`, and the AF point maps in `client/delegates/nikon-points.js` (data converted from the plugin's `focus_points/nikon corporation/*.txt`, submitted there by "capricorn8"). Nothing was taken from digiKam. `test/` and the sample tools in `tools/` are outside the staged dirs, so they do not ship. The README's supported-camera list can be built from the per-make tables in CLAUDE.md.

2026-11-11: built, apart from the certificate itself.

- `LICENSE` is **Apache 2.0, chosen by Claude as the default** because most of the geometry is ported from an Apache 2.0 project. Cru should confirm or change it before the first release. `THIRD_PARTY_NOTICES.md` covers the Lr plugin (file by file), ExifTool + its bundled Strawberry Perl, and Adobe's CSInterface.js. Both files are in the package.
- `tools/build-release.sh` (`VERSION`, `RELEASE_CERT`, `RELEASE_CERT_PASS` from the environment, no defaults) writes `dist/focuspoints-v<version>.zxp` and the unpacked `dist/extension/`, without `.debug`. Run here with the dev cert: signs and verifies.
- **Not timestamped; the second checkbox is left open for that reason.** `ZXPSignCmd` 4.1.103 segfaults or errors against every public timestamp server tried (DigiCert, Sectigo, GlobalSign, Microsoft, Certum, Apple, FreeTSA). Instead the release cert is to be created with a 25-year validity (`-validityDays 9125`; checked that ZXPSignCmd makes and accepts one), which meets the same goal. `TSA_URL` switches timestamping on if a later ZXPSignCmd fixes it.
- Version: the repo manifest is now `0.0.0` (dev); the build stamps the tag's version into the packaged manifest and the panel reads `ExtensionBundleVersion` from it.
- `sign-install.sh` is untouched.
- `README.md` written: what it does, camera table, Windows/macOS install, SmartScreen, updates, bug reports.
- **Left for Cru:** create the release cert and add the two GitHub secrets. The exact commands are in `docs/releasing.md`.
