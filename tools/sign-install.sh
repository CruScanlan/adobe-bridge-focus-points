#!/usr/bin/env bash
# Dev helper: package, self-sign, and install the extension into Bridge's
# user CEP extensions folder. Bridge 2026 refuses to render UNSIGNED CEP
# extensions (lists them, but load fails), so every install must be signed.
#
# Usage: tools/sign-install.sh
#
# Machine-specific config lives in tools/.env (gitignored). Copy
# tools/.env.example to tools/.env and adjust. Recognised vars:
#   REPO       repo root            (default: parent of this script's dir)
#   CEP_EXT    CEP extensions dir   (default: $APPDATA/Adobe/CEP/extensions)
#   TMPDIR     scratch dir          (default: $LOCALAPPDATA/Temp or /tmp)
#   CERT_PASS  signing cert pass    (default: bfp-dev-pass)
#   EXT_ID     extension id         (default: com.cru.bridgefocuspoints)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load machine-specific config if present.
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; . "$SCRIPT_DIR/.env"; set +a
fi

# Convert a Windows-style path (C:\...) to a Git-Bash path (/c/...) if needed.
to_unix() { command -v cygpath >/dev/null 2>&1 && cygpath -u "$1" || echo "$1"; }

REPO="${REPO:-$(cd "$SCRIPT_DIR/.." && pwd)}"
TOOLS="$REPO/tools"

EXT_ID="${EXT_ID:-com.cru.bridgefocuspoints}"
CERT_PASS="${CERT_PASS:-bfp-dev-pass}"

CEP_EXT="${CEP_EXT:-$(to_unix "${APPDATA:-$HOME/AppData/Roaming}")/Adobe/CEP/extensions}"
TMP="$(to_unix "${TMPDIR:-${LOCALAPPDATA:-$HOME/AppData/Local}/Temp}")"

INST="$CEP_EXT/$EXT_ID"
STAGE="$TMP/fp-stage"
ZXP="$TMP/focuspoints.zxp"

# Ensure a signing cert exists (self-signed, dev only).
if [ ! -f "$TOOLS/cert.p12" ]; then
  "$TOOLS/ZXPSignCmd.exe" -selfSignedCert US WA Cru "Bridge Focus Points" "$CERT_PASS" "$TOOLS/cert.p12"
fi

# Stage only the files that ship in the extension.
rm -rf "$STAGE"; mkdir -p "$STAGE"
for item in CSXS client host vendor .debug; do
  [ -e "$REPO/$item" ] && cp -r "$REPO/$item" "$STAGE/"
done

# Sign -> zxp.
rm -f "$ZXP"
"$TOOLS/ZXPSignCmd.exe" -sign "$STAGE" "$ZXP" "$TOOLS/cert.p12" "$CERT_PASS"

# Install: replace the installed folder with the signed package contents.
rm -rf "$INST"; mkdir -p "$INST"
unzip -oq "$ZXP" -d "$INST"

# Verify + clear the CEP log for a clean next run.
"$TOOLS/ZXPSignCmd.exe" -verify "$INST" -skipOnlineRevocationChecks 2>&1 | tail -1
: > "$TMP/CEP12-KBRG.log"
echo "Installed signed extension to: $INST"
