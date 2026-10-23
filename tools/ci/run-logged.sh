#!/usr/bin/env bash
# Runs a command, keeps its full output in a log, and on failure publishes the relevant lines as
# GitHub annotations (readable through the API even when raw job logs are not).
# Usage: tools/ci/run-logged.sh <label> <command...>
set -uo pipefail
label="$1"; shift
log="${RUNNER_TEMP:-/tmp}/${label}.log"
"$@" > "$log" 2>&1
status=$?
tail -n 150 "$log"
if [ $status -ne 0 ]; then
  enc() { python3 -c 'import sys;d=sys.stdin.read()[-60000:];print(d.replace("%","%25").replace("\r","").replace("\n","%0A"))'; }
  # Real error lines only (compiler/linker/script errors, Gradle "What went wrong", test failures);
  # long command lines are cut so the annotation stays readable.
  errs=$( { grep -nE "(^|[: ])(error|fatal error):|xcodebuild: error|BUILD FAILED|The following build commands failed|^[[:space:]]+(CompileC|SwiftCompile|SwiftEmitModule|PhaseScriptExecution|Ld|CompileSwiftSources|GenerateDSYMFile) |What went wrong|^> |FAILURE:|Execution failed|❌|FAILED|Error: |Exception" "$log" || true; } \
    | grep -vE "warning:|-Werror|-Wno-error" | cut -c1-400 | head -n 120)
  [ -n "$errs" ] && echo "::error title=${label} (matched errors)::$(printf '%s' "$errs" | enc)"
  echo "::error title=${label} (last 60 lines)::$(tail -n 60 "$log" | enc)"
  { echo "### ${label} failed"; echo '```'; tail -n 80 "$log"; echo '```'; } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
fi
exit $status
