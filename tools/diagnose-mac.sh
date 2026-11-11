#!/bin/sh
# Collect what is needed to debug Bridge Focus Points on a Mac into one text
# file on the Desktop. Read-only, no sudo.
#
#   sh diagnose-mac.sh [photo-file]
#
# With a photo file it also records what the bundled exiftool reads from it.
# The report holds system and Bridge version details, extension file names
# and log tails. Read it before sending it to anyone.

EXT_ID="com.cru.bridgefocuspoints"
EXT="$HOME/Library/Application Support/Adobe/CEP/extensions/$EXT_ID"
OUT="$HOME/Desktop/focuspoints-diagnostics.txt"
PHOTO="${1:-}"

section() { printf '\n== %s ==\n' "$1"; }

{
  echo "Bridge Focus Points diagnostics"
  date

  section "System"
  sw_vers 2>&1
  echo "chip: $(uname -m)"

  section "Bridge"
  found=0
  for app in /Applications/Adobe\ Bridge*/Adobe\ Bridge*.app; do
    [ -d "$app" ] || continue
    found=1
    echo "$app: $(defaults read "$app/Contents/Info" CFBundleShortVersionString 2>&1)"
  done
  [ "$found" = 1 ] || echo "no Adobe Bridge found in /Applications"
  if pgrep -f "Adobe Bridge" >/dev/null 2>&1; then echo "running: yes"; else echo "running: no"; fi

  section "Perl"
  if [ -x /usr/bin/perl ]; then /usr/bin/perl -e 'print "/usr/bin/perl $^V\n"'; else echo "/usr/bin/perl: MISSING"; fi

  section "Extension"
  if [ -d "$EXT" ]; then
    echo "installed at: $EXT"
    grep -o 'ExtensionBundleVersion="[^"]*"' "$EXT/CSXS/manifest.xml" 2>&1
    echo "files: $(find "$EXT" -type f | wc -l | tr -d ' ')"
    ls -la "$EXT"
    if [ -f "$EXT/META-INF/signatures.xml" ]; then echo "signature file: present"; else echo "signature file: MISSING"; fi
    if command -v ZXPSignCmd >/dev/null 2>&1; then
      ZXPSignCmd -verify "$EXT" -skipOnlineRevocationChecks 2>&1 | tail -n 2
    else
      echo "ZXPSignCmd not installed: signature not verified"
    fi
    echo "quarantine flag: $(xattr -p com.apple.quarantine "$EXT" 2>/dev/null || echo none)"
  else
    echo "NOT INSTALLED: $EXT"
  fi

  section "PlayerDebugMode"
  for v in 12 11 10; do
    echo "com.adobe.CSXS.$v: $(defaults read "com.adobe.CSXS.$v" PlayerDebugMode 2>/dev/null || echo "not set")"
  done

  section "exiftool"
  if [ -f "$EXT/client/lib/exiftool-unix.pl" ] && [ -x /usr/bin/perl ]; then
    echo "version: $(/usr/bin/perl "$EXT/client/lib/exiftool-unix.pl" -ver 2>&1)"
    if [ -n "$PHOTO" ]; then
      echo "file: $(basename "$PHOTO")"
      /usr/bin/perl "$EXT/client/lib/exiftool-unix.pl" -s -Make -Model -FileType -Orientation \
        -FocusMode -AFAreaMode -FocusPixel -FocusLocation -AFAreaXPosition -AFAreaYPosition \
        -AFPointsInFocus -AFPointsSelected -PrimaryAFPoint -AFFocusArea \
        -PreviewImage -JpgFromRaw "$PHOTO" 2>&1
    fi
  else
    echo "cannot run (extension or perl missing)"
  fi

  section "CEP logs"
  for log in "$HOME"/Library/Logs/CSXS/CEP*-KBRG.log "$HOME"/Library/Logs/CSXS/CEPHtmlEngine*-KBRG-*"$EXT_ID"*.log; do
    [ -f "$log" ] || continue
    echo "--- $log (last 60 lines)"
    tail -n 60 "$log"
  done
  ls "$HOME/Library/Logs/CSXS/" 2>&1 | head -n 40
} > "$OUT" 2>&1

echo "Wrote $OUT"
echo "Read it, then attach it to your bug report."
