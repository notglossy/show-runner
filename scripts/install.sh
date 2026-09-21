#!/usr/bin/env bash
# Build the ShowRunner kiosk APK and install/configure it on a device over adb.
#
#   scripts/install.sh [options]
#
#   --server URL       write /sdcard/showrunner/config.json with this server URL (needs --secret)
#   --secret SECRET    DEVICE_SHARED_SECRET for the config file
#   --home             make ShowRunner the default Home app (launcher kiosk mode; the normal setup)
#   --strict           also make it device owner (strict lock task mode; optional). Requires zero accounts.
#                      Leave strict mode any time from the on-device exit menu or the dashboard.
#   --release          build/install the release APK signed with your key (see docs/device-setup.md)
#   --reinstall        uninstall first; needed once when switching between debug and release signing.
#                      The device keeps its ID (/sdcard/showrunner/device-id) and config, so no re-claim.
#   --no-build         install the existing APK without rebuilding
#   --apk PATH         install this APK as-is instead of building (e.g. from GitHub Releases); not with --release
#   --serial S         adb target, e.g. 192.168.1.50:5555 (default: $ANDROID_SERIAL, else the
#                      only connected device)
#
# Everything this script does on the device is also written out in docs/device-setup.md.
set -euo pipefail

PKG=com.notglossy.showrunner
ACTIVITY=$PKG/.MainActivity
ADMIN=$PKG/.KioskDeviceAdminReceiver
CONFIG_PATH=/sdcard/showrunner/config.json

server=""
secret=""
device_owner=false
home=false
build=true
variant=debug
reinstall=false
apk_path=""
serial=${ANDROID_SERIAL:-}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) server=$2; shift 2 ;;
    --secret) secret=$2; shift 2 ;;
    --strict|--device-owner) device_owner=true; shift ;;
    --home) home=true; shift ;;
    --no-build) build=false; shift ;;
    --release) variant=release; shift ;;
    --reinstall) reinstall=true; shift ;;
    --serial) serial=$2; shift 2 ;;
    --apk) apk_path=$2; build=false; shift 2 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "install: unknown option $1" >&2; exit 2 ;;
  esac
done

if [[ -n "$server" && -z "$secret" ]] || [[ -z "$server" && -n "$secret" ]]; then
  echo "install: --server and --secret must be given together" >&2
  exit 2
fi

repo_root=$(cd "$(dirname "$0")/.." && pwd)
android_dir=$repo_root/apps/android
apk_for() { echo "$android_dir/app/build/outputs/apk/$1/app-$1.apk"; }

sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}
adb_bin=$(command -v adb || true)
[[ -z "$adb_bin" && -x "$sdk/platform-tools/adb" ]] && adb_bin=$sdk/platform-tools/adb
[[ -n "$adb_bin" ]] || { echo "install: adb not found (install platform-tools or set ANDROID_HOME)" >&2; exit 2; }
# Without a serial adb picks the only connected device and fails if there are several.
adb() { "$adb_bin" ${serial:+-s "$serial"} "$@"; }
step() { printf '\n==> %s\n' "$*"; }

if $build; then
  step "Building $variant APK"
  if [[ -z "${JAVA_HOME:-}" ]]; then
    studio_jbr="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    [[ -d "$studio_jbr" ]] && export JAVA_HOME=$studio_jbr
  fi
  task=assembleDebug
  [[ $variant == release ]] && task=assembleRelease
  (cd "$android_dir" && ./gradlew "$task" --console=plain -q)
fi
if [[ -n "$apk_path" ]]; then
  [[ $variant == debug ]] || { echo "install: --apk installs the given file as-is; drop --release" >&2; exit 2; }
  apk=$apk_path
  [[ -f "$apk" ]] || { echo "install: $apk not found; check the --apk path" >&2; exit 1; }
else
  apk=$(apk_for "$variant")
  [[ -f "$apk" ]] || { echo "install: $apk not found; run without --no-build" >&2; exit 1; }
fi

if [[ "$serial" == *:* ]]; then
  step "Connecting to $serial"
  "$adb_bin" connect "$serial" >/dev/null || true
fi
# Keep stderr: with several devices and no serial, adb refuses with "more than one
# device/emulator" rather than picking one, and that text is the useful error here. Only
# the last line counts, so a cold adb server's "daemon started" banner does not mask it.
state=$(adb get-state 2>&1 | tail -n1 || true)
if [[ "$state" != device ]]; then
  echo "install: ${serial:-device} is '${state:-unreachable}'. Wake the device and accept the debugging prompt." >&2
  [[ "$state" == *"more than one device"* ]] && echo "install: several devices attached; set ANDROID_SERIAL or pass --serial." >&2
  exit 1
fi

if $reinstall; then
  step "Uninstalling the current app (config.json and device-id on /sdcard are kept)"
  adb shell "test -f /sdcard/showrunner/device-id" \
    || echo "warning: /sdcard/showrunner/device-id not found; the device will get a new ID and need claiming again"
  adb uninstall "$PKG" || true
fi

step "Installing $(basename "$apk")"
# -r keep data, -t allow testOnly (debug builds are testOnly)
if ! out=$(adb install -r -t "$apk" 2>&1); then
  echo "$out"
  if grep -q "INSTALL_FAILED_UPDATE_INCOMPATIBLE" <<<"$out"; then
    echo "install: the installed app is signed with a different key (debug vs release). Re-run with --reinstall." >&2
  fi
  exit 1
fi
echo "$out" | tail -1

step "Granting app ops"
adb shell appops set $PKG MANAGE_EXTERNAL_STORAGE allow   # read /sdcard/showrunner/config.json
adb shell appops set $PKG SYSTEM_ALERT_WINDOW allow       # start on boot when not device owner

if [[ -n "$server" ]]; then
  step "Writing $CONFIG_PATH"
  tmp=$(mktemp -t showrunner-config.XXXXXX)
  trap 'rm -f "$tmp"' EXIT
  python3 -c 'import json,sys; print(json.dumps({"serverUrl": sys.argv[1], "sharedSecret": sys.argv[2]}, indent=2))' "$server" "$secret" >"$tmp"
  adb shell mkdir -p "$(dirname $CONFIG_PATH)"
  adb push "$tmp" "$CONFIG_PATH" >/dev/null
fi

if $home; then
  step "Setting ShowRunner as the default Home app"
  # The HOME role is what Android 10+ persists as the default Home app.
  adb shell cmd role add-role-holder android.app.role.HOME "$PKG" 0
fi

if $device_owner; then
  step "Setting device owner (strict mode)"
  if adb shell dumpsys device_policy | grep -q "Device Owner"; then
    echo "already has a device owner:"
    adb shell dumpsys device_policy | grep -A2 "Device Owner" | sed 's/^/  /'
  else
    accounts=$(adb shell dumpsys account | sed -n 's/^ *Accounts: \([0-9]*\).*/\1/p' | head -1)
    if [[ "${accounts:-0}" != "0" ]]; then
      echo "install: device has $accounts account(s); remove them before setting device owner" >&2
      exit 1
    fi
    adb shell dpm set-device-owner "$ADMIN"
  fi
fi

step "Launching"
adb shell am start -n "$ACTIVITY" >/dev/null
sleep 2

step "Done"
echo "Device ID: $(adb shell cat /sdcard/showrunner/device-id 2>/dev/null | tr -d '\r')"
echo "Logs:      $adb_bin${serial:+ -s $serial} logcat -s ShowRunner ShowRunner.Web ShowRunner.Kiosk ShowRunner.Config"
