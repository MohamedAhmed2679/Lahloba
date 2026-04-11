#!/usr/bin/env bash
echo "🧪 Running all Lahloba tests..."
echo ""

echo "── API Tests (91 endpoints) ──"
node test-env/server.js &
SERVER_PID=$!
sleep 2
node test-env/test-runner.js
API_RESULT=$?
kill $SERVER_PID 2>/dev/null

echo ""
echo "── Flutter Tests ──"
cd apps/mobile && flutter test 2>&1
FLUTTER_RESULT=$?

echo ""
if [ $API_RESULT -eq 0 ] && [ $FLUTTER_RESULT -eq 0 ]; then
  echo "🎉 All tests passed!"
else
  echo "⚠️  Some tests failed"
fi
