#!/usr/bin/env bash
echo "🍽️  Starting Lahloba..."
docker compose up -d
echo "Waiting for services..."
sleep 5

echo "Starting API..."
cd apps/api && npm run dev &
API_PID=$!

echo "Starting Realtime Gateway..."
cd apps/realtime-gateway && npm run dev &
RT_PID=$!

echo "Starting Admin Web..."
cd apps/admin-web && npm run dev &
ADMIN_PID=$!

echo ""
echo "═══════════════════════════════"
echo "  All services running!"
echo "  API:    http://localhost:3000"
echo "  Admin:  http://localhost:3002"
echo "  Swagger: http://localhost:3000/docs"
echo ""
echo "  Press Ctrl+C to stop all"
echo "═══════════════════════════════"

trap "kill $API_PID $RT_PID $ADMIN_PID 2>/dev/null; docker compose stop; exit" INT TERM
wait
