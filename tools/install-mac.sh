#!/bin/sh
# Install (or update) Bridge Focus Points on macOS.
#
#   curl -fsSL https://github.com/CruScanlan/adobe-bridge-focus-points/releases/latest/download/install-mac.sh | sh
#
# Downloads the latest release package and unpacks it into your user CEP
# extensions folder. No sudo. Run it again to update.
#
#   ... | sh -s -- --uninstall     remove the extension
#
# FOCUSPOINTS_ZXP=/path/to/file.zxp installs a local package instead of
# downloading (used by the CI check).
set -eu

REPO="CruScanlan/adobe-bridge-focus-points"
EXT_ID="com.cru.bridgefocuspoints"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/$EXT_ID"

if pgrep -f "Adobe Bridge" >/dev/null 2>&1; then
  echo "Note: Bridge is running. Quit and reopen it when this finishes."
fi

if [ "${1:-}" = "--uninstall" ]; then
  rm -rf "$DEST"
  echo "Focus Points removed."
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "${FOCUSPOINTS_ZXP:-}" ]; then
  cp "$FOCUSPOINTS_ZXP" "$TMP/focuspoints.zxp"
else
  echo "Looking up the latest release..."
  URL="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" |
    grep -o 'https://[^"]*\.zxp' | head -n 1)"
  if [ -z "$URL" ]; then
    echo "Could not find a release package. See https://github.com/$REPO/releases" >&2
    exit 1
  fi
  echo "Downloading $URL"
  curl -fsSL -o "$TMP/focuspoints.zxp" "$URL"
fi

# The folder must hold exactly the signed package's files, so start clean.
mkdir -p "$TMP/ext"
unzip -oq "$TMP/focuspoints.zxp" -d "$TMP/ext"
rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
mv "$TMP/ext" "$DEST"

if [ ! -x /usr/bin/perl ]; then
  echo "Warning: /usr/bin/perl is missing. Focus Points needs Perl to read metadata."
fi

echo "Focus Points installed to:"
echo "  $DEST"
echo "Restart Bridge, then open Window > Extensions > Focus Points."
