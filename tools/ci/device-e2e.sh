#!/usr/bin/env bash
# Installs an app build on the running emulator/simulator and runs its Maestro flows.
# Failures are published as GitHub annotations (flow name, failing step, message), and the
# screenshots and JUnit report stay in the uploaded artifact.
# Usage: tools/ci/device-e2e.sh <android|ios> <app> <path-to-apk-or-.app> [device-id]
set -uo pipefail
platform="$1"; app="$2"; bundle="$3"; device="${4:-}"
out="maestro-${platform}-${app}"
mkdir -p "$out"
if [ "$platform" = "android" ]; then
  adb install -r "$bundle" > "$out/install.log" 2>&1 || { echo "::error title=adb install (${app})::$(tail -n 20 "$out/install.log" | tr '\n' ' ')"; exit 1; }
else
  xcrun simctl install "$device" "$bundle" > "$out/install.log" 2>&1 || { echo "::error title=simctl install (${app})::$(tail -n 20 "$out/install.log" | tr '\n' ' ')"; exit 1; }
fi
args=(test ".maestro/${app}" --format junit --output "${out}.xml" --test-output-dir "$out")
[ -n "$device" ] && args=(--device "$device" "${args[@]}")
maestro "${args[@]}" > "$out/maestro.log" 2>&1
status=$?
tail -n 120 "$out/maestro.log"
if [ $status -ne 0 ]; then
  python3 - "${out}.xml" "$out/maestro.log" "$platform" "$app" <<'PY'
import sys, xml.etree.ElementTree as ET, re
xml, log, platform, app = sys.argv[1:5]
enc = lambda s: s.replace('%', '%25').replace('\r', '').replace('\n', '%0A')
msgs = []
try:
    for tc in ET.parse(xml).getroot().iter('testcase'):
        for f in list(tc.findall('failure')) + list(tc.findall('error')):
            msgs.append(f"{tc.get('name')}: {(f.get('message') or '')} {(f.text or '').strip()[:800]}")
except Exception as e:
    msgs.append(f'no junit report ({e})')
lines = open(log, errors='replace').read().splitlines()
interesting = [l for l in lines if re.search(r'(FAILED|Failed|❌|Assertion|not found|Unable|Error|Exception|timed out|Timeout)', l)][:60]
print(f"::error title=Maestro {platform}/{app} failures::" + enc('\n'.join(msgs + ['--- log ---'] + interesting + ['--- tail ---'] + lines[-40:]))[:60000])
PY
fi
exit $status
