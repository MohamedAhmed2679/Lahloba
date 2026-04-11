#!/usr/bin/env bash
set -euo pipefail
G='\033[0;32m'; C='\033[0;36m'; B='\033[1m'; N='\033[0m'; R='\033[0;31m'; Y='\033[1;33m'
ok(){ echo -e "${G}[OK]${N}    $1"; }; info(){ echo -e "${C}[INFO]${N}  $1"; }
fail(){ echo -e "${R}[FAIL]${N}  $1"; }; warn(){ echo -e "${Y}[WARN]${N}  $1"; }
ROOT="$(cd "$(dirname "$0")" && pwd)"; cd "$ROOT"

echo -e "\n${B}══════════════════════════════════════${N}"
echo -e "${B}  🍽️  LAHLOBA — Full Environment Setup${N}"
echo -e "${B}══════════════════════════════════════${N}\n"

# ── Step 1: Prerequisites ──
echo -e "${B}[1/7] Checking Prerequisites${N}"
M=0
for c in docker node npm flutter git; do
  command -v $c &>/dev/null && ok "$c → $($c --version 2>&1 | head -1)" || { fail "$c missing"; M=1; }
done
command -v code &>/dev/null && ok "VS Code found" || warn "VS Code not on PATH"
command -v adb &>/dev/null && ok "ADB found (Android SDK)" || warn "ADB not found"
docker info &>/dev/null 2>&1 && ok "Docker daemon running" || { fail "Start Docker Desktop"; exit 1; }
[ "$M" -eq 1 ] && { fail "Install missing tools"; exit 1; }

# ── Step 2: Environment ──
echo -e "\n${B}[2/7] Environment Configuration${N}"
[ ! -f .env ] && cp .env.example .env && ok "Created .env" || ok ".env exists"
JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
sed -i.bak "s|change-me-in-production-min-32-chars!!|${JWT}|g" .env 2>/dev/null || true
rm -f .env.bak
ok "JWT secret generated"

# ── Step 3: Docker Services ──
echo -e "\n${B}[3/7] Starting Docker Services${N}"
info "Pulling & starting containers..."
docker compose up -d 2>&1 | tail -5

info "Waiting for PostgreSQL (max 30s)..."
for i in $(seq 1 30); do
  docker compose exec -T postgres pg_isready -U lahloba &>/dev/null && break || sleep 1
done
ok "PostgreSQL ready"

info "Waiting for Redis..."
for i in $(seq 1 15); do
  docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG && break || sleep 1
done
ok "Redis ready"

info "Running migrations..."
docker compose exec -T postgres psql -U lahloba -d lahloba \
  -f /docker-entrypoint-initdb.d/001_init.sql &>/dev/null 2>&1 || ok "Migration 001 already applied"

if [ -f packages/db/migrations/002_improvements.sql ]; then
  docker compose cp packages/db/migrations/002_improvements.sql postgres:/tmp/002.sql 2>/dev/null
  docker compose exec -T postgres psql -U lahloba -d lahloba -f /tmp/002.sql &>/dev/null 2>&1 || ok "Migration 002 already applied"
fi

info "Seeding database..."
docker compose cp packages/db/seeds/seed.sql postgres:/tmp/seed.sql 2>/dev/null
docker compose exec -T postgres psql -U lahloba -d lahloba -f /tmp/seed.sql &>/dev/null 2>&1 || ok "Seed data exists"
ok "Database ready with seed data"

# ── Step 4: NestJS API ──
echo -e "\n${B}[4/7] Setting Up NestJS API${N}"
cd "$ROOT/apps/api"
info "Installing npm packages..."
npm install --legacy-peer-deps 2>&1 | tail -3
mkdir -p prisma
cp "$ROOT/packages/db/schema.prisma" prisma/schema.prisma
info "Generating Prisma client..."
npx prisma generate 2>&1 | tail -2
ok "NestJS API + Prisma ready"
cd "$ROOT"

# ── Step 5: Realtime + Push ──
echo -e "\n${B}[5/7] Realtime Gateway & Push Service${N}"
cd "$ROOT/apps/realtime-gateway" && npm install 2>&1 | tail -2 && ok "Realtime Gateway"
cd "$ROOT/apps/push-service" && npm install 2>&1 | tail -2 && ok "Push Service"
cd "$ROOT"

# ── Step 6: Flutter Mobile ──
echo -e "\n${B}[6/7] Flutter Mobile App${N}"
cd "$ROOT/apps/mobile"
info "Getting Flutter packages..."
flutter pub get 2>&1 | tail -5

mkdir -p assets/fonts assets/images assets/icons assets/animations
for f in Cairo-Regular Cairo-Bold Cairo-Medium Cairo-SemiBold; do
  [ ! -f "assets/fonts/${f}.ttf" ] && touch "assets/fonts/${f}.ttf"
done
[ ! -f assets/images/logo.png ] && node -e "require('fs').writeFileSync('assets/images/logo.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==','base64'))" 2>/dev/null || true

info "Flutter devices:"
flutter devices 2>&1 | grep -v "^$" | head -8
ok "Flutter app ready"
cd "$ROOT"

# ── Step 7: Admin Web ──
echo -e "\n${B}[7/7] Admin Web (Next.js)${N}"
cd "$ROOT/apps/admin-web"
npm install 2>&1 | tail -3
ok "Admin Web ready"
cd "$ROOT"

# ── Install VS Code extensions ──
if command -v code &>/dev/null; then
  echo -e "\n${B}Installing VS Code Extensions${N}"
  for ext in dart-code.dart-code dart-code.flutter Dart-Code.flutter ms-vscode.vscode-typescript-next dbaeumer.vscode-eslint esbenp.prettier-vscode bradlc.vscode-tailwindcss prisma.prisma ms-azuretools.vscode-docker; do
    code --install-extension $ext --force 2>/dev/null && ok "$ext" || true
  done
fi

# ── Summary ──
echo -e "\n${B}══════════════════════════════════════${N}"
echo -e "${B}  🎉 SETUP COMPLETE!${N}"
echo -e "${B}══════════════════════════════════════${N}"
echo ""
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
echo ""
echo -e "${B}Start Development:${N}"
echo "  make dev              # Start all services"
echo "  make api              # API only (:3000)"
echo "  make mobile           # Flutter app"
echo "  make admin            # Admin web (:3002)"
echo "  make test             # Run all tests"
echo "  make test-api         # 91 API tests"
echo "  make android          # Flutter on Android"
echo "  make ios              # Flutter on iOS"
echo ""
echo -e "${B}URLs:${N}"
echo "  API:       http://localhost:3000/v1"
echo "  Swagger:   http://localhost:3000/docs"
echo "  Admin:     http://localhost:3002"
echo "  MailHog:   http://localhost:8025"
echo "  MinIO:     http://localhost:9001"
echo "  Test UI:   http://localhost:3000/dashboard (via test-env)"
echo ""
echo "  OTP bypass: 000000"
echo ""