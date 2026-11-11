#!/usr/bin/env bash
# Build the release package: a signed .zxp with no .debug file.
#
#   VERSION=1.2.3 RELEASE_CERT=/path/release.p12 RELEASE_CERT_PASS=... \
#     bash tools/build-release.sh
#
# Writes:
#   dist/focuspoints-v<VERSION>.zxp   the package (Windows and macOS)
#   dist/extension/                   the same files unpacked, for the installer
#
# Environment:
#   VERSION            required. "v1.2.3" and "1.2.3-rc1" are accepted; the
#                      manifest gets the numeric part (1.2.3).
#   RELEASE_CERT       required. Path to the release .p12. Never committed.
#   RELEASE_CERT_PASS  required. Its password.
#   TSA_URL            optional timestamp server. Off by default: ZXPSignCmd
#                      4.1.103 crashes or fails against every public server
#                      tried (see docs/releasing.md). The release cert is made
#                      with a 25-year validity instead, so installed copies do
#                      not stop loading when a short-lived cert would expire.
#   ZXPSIGN            ZXPSignCmd binary (default: tools/ZXPSignCmd.exe).
#
# The dev install (tools/sign-install.sh) is separate and unchanged.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZXPSIGN="${ZXPSIGN:-$REPO/tools/ZXPSignCmd.exe}"
TSA_URL="${TSA_URL:-none}"

: "${VERSION:?set VERSION, e.g. VERSION=1.2.3}"
: "${RELEASE_CERT:?set RELEASE_CERT to the release .p12}"
: "${RELEASE_CERT_PASS:?set RELEASE_CERT_PASS}"

TAG="${VERSION#v}"
NUMERIC="${TAG%%-*}"
if ! [[ "$NUMERIC" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "VERSION must look like 1.2.3 (got '$VERSION')" >&2; exit 1
fi

DIST="$REPO/dist"
STAGE="$DIST/stage"
ZXP="$DIST/focuspoints-v$TAG.zxp"
rm -rf "$DIST"; mkdir -p "$STAGE"

# Only what ships. No .debug: it would open a remote-debug port on users' machines.
for item in CSXS client host vendor LICENSE THIRD_PARTY_NOTICES.md; do
  cp -r "$REPO/$item" "$STAGE/"
done

# The manifest is the one place the version lives; the panel reads it from there.
sed -i.bak -E \
  -e "s/ExtensionBundleVersion=\"[^\"]*\"/ExtensionBundleVersion=\"$NUMERIC\"/" \
  -e "s/(<Extension Id=\"[^\"]*\" Version=)\"[^\"]*\"/\1\"$NUMERIC\"/" \
  "$STAGE/CSXS/manifest.xml"
rm "$STAGE/CSXS/manifest.xml.bak"
grep -q "ExtensionBundleVersion=\"$NUMERIC\"" "$STAGE/CSXS/manifest.xml"

SIGN_ARGS=(-sign "$STAGE" "$ZXP" "$RELEASE_CERT" "$RELEASE_CERT_PASS")
[ "$TSA_URL" != "none" ] && SIGN_ARGS+=(-tsa "$TSA_URL")
"$ZXPSIGN" "${SIGN_ARGS[@]}"

# The installed folder must be exactly the signed package's contents.
mkdir -p "$DIST/extension"
unzip -oq "$ZXP" -d "$DIST/extension"
"$ZXPSIGN" -verify "$DIST/extension" -skipOnlineRevocationChecks | tail -1
rm -rf "$STAGE"

echo "Built $ZXP (version $NUMERIC)"
