#!/bin/bash
set -e
BASE="${API_URL:-http://localhost:3000/v1}"
echo "Lahloba Smoke Test — $BASE"
echo -n "Health... "; curl -sf "$BASE/../docs" > /dev/null && echo "OK" || echo "FAIL"
echo -n "OTP request... "; curl -sf -X POST "$BASE/auth/otp/request" -H "Content-Type: application/json" -d '{"phone":"+201000000001"}' | grep -q "OTP" && echo "OK" || echo "FAIL"
echo -n "OTP verify... "; R=$(curl -sf -X POST "$BASE/auth/otp/verify" -H "Content-Type: application/json" -d '{"phone":"+201000000001","code":"000000"}'); T=$(echo "$R" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4); [ -n "$T" ] && echo "OK" || echo "FAIL"
echo "Done"
