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
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-240000}"
dump_screen() { # $1 = label. Visible texts and ids right now, as an annotation.
  maestro ${device:+--device "$device"} hierarchy > "$out/hierarchy-$1.json" 2>/dev/null || true
  python3 - "$out/hierarchy-$1.json" > "$out/screen-$1.txt" <<'PY2' || true
import json, sys
seen = []
def walk(n):
    a = n.get('attributes', {})
    for k in ('text', 'accessibilityText', 'resource-id'):
        v = a.get(k)
        if v and v not in seen and not v.startswith('com.android.systemui'): seen.append(v)
    for c in n.get('children', []) or []: walk(c)
try: walk(json.load(open(sys.argv[1])))
except Exception as e: seen.append(f'(no hierarchy: {e})')
print(' | '.join(seen)[:4000])
PY2
  echo "::error title=Screen at failure (${platform}/${app}/$1)::$(tr '\n' ' ' < "$out/screen-$1.txt" | sed 's/%/%25/g')"
}
status=0
: > "$out/maestro.log"
# One flow per run, so the screen is captured right after the flow that failed.
for flow in .maestro/${app}/*.yaml; do
  name=$(basename "$flow" .yaml)
  args=(test "$flow" --format junit --output "${out}-${name}.xml" --test-output-dir "$out")
  [ -n "$device" ] && args=(--device "$device" "${args[@]}")
  for attempt in 1 2; do
    maestro "${args[@]}" > "$out/maestro-${name}.log" 2>&1
    rc=$?
    # Retry once only when the iOS test driver never came up (runner capacity, not the app).
    if [ $rc -ne 0 ] && [ $attempt -eq 1 ] && grep -q 'iOS driver not ready in time' "$out/maestro-${name}.log"; then
      echo "Driver did not start for ${name}; retrying once."; continue
    fi
    break
  done
  cat "$out/maestro-${name}.log" >> "$out/maestro.log"
  tail -n 40 "$out/maestro-${name}.log"
  if [ $rc -ne 0 ]; then status=$rc; dump_screen "$name"; fi
done
if [ $status -ne 0 ]; then
  python3 - "$out" "$out/maestro.log" "$platform" "$app" <<'PY'
import sys, xml.etree.ElementTree as ET, re, glob, os
out, log, platform, app = sys.argv[1:5]
enc = lambda s: s.replace('%', '%25').replace('\r', '').replace('\n', '%0A')
msgs = []
for xml in sorted(glob.glob(out + '-*.xml')):
    try:
        for tc in ET.parse(xml).getroot().iter('testcase'):
            for f in list(tc.findall('failure')) + list(tc.findall('error')):
                msgs.append(f"{tc.get('name')}: {(f.get('message') or '')} {(f.text or '').strip()[:800]}")
    except Exception as e:
        msgs.append(f'{os.path.basename(xml)}: no junit report ({e})')
lines = open(log, errors='replace').read().splitlines()
interesting = [l for l in lines if re.search(r'(FAILED|Failed|❌|Assertion|not found|Unable|Error|Exception|timed out|Timeout)', l)][:40]
print(f"::error title=Maestro {platform}/{app} failures::" + enc('\n'.join(msgs + ['--- log ---'] + interesting))[:60000])
PY
fi
exit $status
