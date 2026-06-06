#!/usr/bin/env bash

set -euo pipefail

dmg_path="${1:-}"
if [[ -z "$dmg_path" || ! -f "$dmg_path" ]]; then
  echo "Usage: $0 /path/to/Browso.dmg" >&2
  exit 1
fi

mount_dir="$(mktemp -d "${TMPDIR:-/tmp}/browso-adhoc-dmg.XXXXXX")"
cleanup() {
  hdiutil detach "$mount_dir" -quiet >/dev/null 2>&1 || true
  rmdir "$mount_dir" >/dev/null 2>&1 || true
}
trap cleanup EXIT

hdiutil attach "$dmg_path" -readonly -nobrowse -mountpoint "$mount_dir" -quiet

app_path="$(find "$mount_dir" -maxdepth 1 -type d -name 'Browso.app' -print -quit)"
if [[ -z "$app_path" ]]; then
  echo "Browso.app was not found in $dmg_path" >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$app_path"

signature_details="$(codesign -dv --verbose=4 "$app_path" 2>&1)"
if ! grep -q '^Signature=adhoc$' <<<"$signature_details"; then
  echo "The application does not have the expected ad-hoc signature." >&2
  exit 1
fi

if ! grep -q '^Identifier=com.browso.browser$' <<<"$signature_details"; then
  echo "The application does not use the com.browso.browser bundle ID." >&2
  exit 1
fi

echo "Verified the ad-hoc signature for Browso.app."
