# 03: Release hygiene: licenses, release cert, no .debug, version

**What to build:** The things every public build needs, whatever the channel.

- **Licenses.** Add a `LICENSE` for the project and a `THIRD_PARTY_NOTICES` file shipped inside the extension: the Focus-Points Lr plugin is Apache 2.0 (we ported its Fuji geometry, so attribution and its license text are required); exiftool is redistributable with its notice. digiKam is GPL — it stays a cross-reference only and no code is copied from it.
- **Release certificate.** A new private signing cert for releases, separate from the dev `tools/cert.p12` (whose password `bfp-dev-pass` is in a committed script). It never enters the repo; ticket 05 reads it from GitHub secrets. Release signing uses a timestamp server (`ZXPSignCmd -sign … -tsa <url>`) so installed copies keep working after the cert expires.
- **No `.debug` in release builds.** It opens remote-debug port 8088 on users' machines. Dev installs keep it.
- **One version number.** `ExtensionBundleVersion` / `Extension Version` in `CSXS/manifest.xml` come from a single source the release build can stamp (the git tag), and the panel can read at runtime (for ticket 06).
- **README** for users: what it does, supported cameras, install, the SmartScreen note, how updates work.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] `LICENSE` and `THIRD_PARTY_NOTICES` exist; the notices file is in the staged extension
- [ ] A release build (script or flag) produces a timestamped `.zxp` without `.debug`, signed with a cert passed in by environment variable, not a committed default
- [ ] Version stamped into the manifest from one place; panel can read it
- [ ] Dev `sign-install.sh` behaves exactly as before
- [ ] README covers install, update and SmartScreen
