# Releasing

A release is one command:

```
git tag v1.2.3 && git push origin v1.2.3
```

`.github/workflows/release.yml` then runs CI (Windows and macOS), and if it
passes builds the signed package and the Windows installer and publishes a
GitHub Release with:

- `FocusPointsSetup-v1.2.3.exe` — Windows installer (Inno Setup, unsigned)
- `focuspoints-v1.2.3.zxp` — the signed extension, for both platforms
- `install-mac.sh`, `diagnose-mac.sh` — the Mac scripts the README links to

A tag with a suffix, such as `v1.2.3-rc1`, is published as a pre-release.
Pre-releases are not offered by the panel's update banner or fetched by the
Mac install script (both use GitHub's "latest release").

The version comes from the tag only. The repo's `CSXS/manifest.xml` stays at
`0.0.0` (a dev build, which never checks for updates);
`tools/build-release.sh` stamps the tag's version into the packaged copy, and
the panel reads it from there.

## One-time setup: the release certificate

Releases are signed with their own self-signed certificate, not the dev one
(`tools/cert.p12`, whose password is public). It lives only in the repo's
GitHub secrets.

1. Create it, with a 25-year validity and a password of your choosing:

   ```
   tools/ZXPSignCmd.exe -selfSignedCert AU VIC "Cru Scanlan" "Bridge Focus Points" "<password>" release.p12 -validityDays 9125
   ```

2. In the GitHub repo, Settings > Secrets and variables > Actions, add:
   - `RELEASE_CERT_PASS`: the password
   - `RELEASE_CERT_P12`: the file, base64-encoded (`base64 -w0 release.p12`)

3. Keep `release.p12` and the password somewhere safe outside the repo (a
   password manager). Do not commit it.

Losing the certificate is not a disaster: a new one works, because Bridge
checks that the package is intact, not who signed it.

**Why no timestamp.** A timestamp would keep installed copies valid after the
certificate expires. `ZXPSignCmd` 4.1.103 crashed or failed against every
public timestamp server tried (DigiCert, Sectigo, GlobalSign, Microsoft,
Certum, Apple, FreeTSA; 2026-11-11), so the long validity does that job
instead. `TSA_URL=<server>` turns timestamping on in `build-release.sh` if
that changes.

## Building a release locally

```
VERSION=1.2.3 RELEASE_CERT=/path/release.p12 RELEASE_CERT_PASS=... bash tools/build-release.sh
iscc /DAppVersion=1.2.3 tools\installer.iss
```

The first writes `dist/focuspoints-v1.2.3.zxp` and `dist/extension/`; the
second (needs [Inno Setup 6](https://jrsoftware.org/isinfo.php)) writes
`dist/FocusPointsSetup-v1.2.3.exe`.

## What CI checks

`.github/workflows/ci.yml`, on every push and before every release, on
Windows and macOS:

- `node --test`: every committed camera sample through its delegate.
- `tools/check-exiftool.js`: the bundled exiftool on a few real raw files
  (downloaded from raw.pixls.us), compared with the committed samples. On
  macOS this runs ExifTool on the system Perl, as the panel does there.
- macOS only: `install-mac.sh` installs, reinstalls and uninstalls cleanly.
- `shellcheck` on the shell scripts.

CI cannot run Bridge. Whether Bridge loads the panel is checked by hand on
Windows, and was a one-off check on a Mac
(`.scratch/public-release/issues/10-test-on-a-real-mac.md`).
