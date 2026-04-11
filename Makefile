.PHONY: setup dev stop api mobile admin test clean

# Full setup (first time)
setup:
	@chmod +x setup.sh && ./setup.sh

# Docker
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

# Start API (:3000)
api:
	cd apps/api && npm run dev

# Realtime Gateway (:3001)
realtime:
	cd apps/realtime-gateway && npm run dev

# Admin Web (:3002)
admin:
	cd apps/admin-web && npm run dev

# Push Service
push:
	cd apps/push-service && npm run dev

# Flutter — auto-detect device
mobile:
	cd apps/mobile && flutter run

# Flutter on specific targets
android:
	cd apps/mobile && flutter run -d android

ios:
	cd apps/mobile && flutter run -d ios

web:
	cd apps/mobile && flutter run -d chrome

# Build releases
build-apk:
	cd apps/mobile && flutter build apk --release

build-aab:
	cd apps/mobile && flutter build appbundle --release

build-ios:
	cd apps/mobile && flutter build ios --release --no-codesign

build-api:
	cd apps/api && npm run build

build-admin:
	cd apps/admin-web && npm run build

# Tests
test: test-api test-flutter
	@echo "All tests done"

test-api:
	@node test-env/server.js & sleep 2 && node test-env/test-runner.js; kill %1 2>/dev/null

test-flutter:
	cd apps/mobile && flutter test

test-e2e:
	cd apps/mobile && flutter test integration_test/

# Prisma
prisma-generate:
	cd apps/api && npx prisma generate

prisma-studio:
	cd apps/api && npx prisma studio

prisma-migrate:
	docker compose exec postgres psql -U lahloba -d lahloba -f /docker-entrypoint-initdb.d/001_init.sql

# Database
db-shell:
	docker compose exec postgres psql -U lahloba -d lahloba

db-seed:
	docker compose cp packages/db/seeds/seed.sql postgres:/tmp/seed.sql
	docker compose exec postgres psql -U lahloba -d lahloba -f /tmp/seed.sql

# Linting
lint:
	cd apps/api && npm run lint
	cd apps/mobile && flutter analyze

format:
	cd apps/api && npx prettier --write "src/**/*.ts"
	cd apps/mobile && dart format lib/

# Cleanup
clean:
	docker compose down -v
	rm -rf apps/api/node_modules apps/api/dist
	rm -rf apps/admin-web/node_modules apps/admin-web/.next
	rm -rf apps/realtime-gateway/node_modules
	rm -rf apps/push-service/node_modules
	cd apps/mobile && flutter clean

# Status
status:
	@echo "Docker:" && docker compose ps
	@echo "\nFlutter:" && cd apps/mobile && flutter devices

help:
	@echo "Lahloba Commands:"
	@echo "  make setup     — Full first-time setup"
	@echo "  make up        — Start Docker services"
	@echo "  make api       — Start NestJS API (:3000)"
	@echo "  make admin     — Start Admin Web (:3002)"
	@echo "  make mobile    — Run Flutter app"
	@echo "  make android   — Run on Android emulator"
	@echo "  make ios       — Run on iOS simulator"
	@echo "  make test      — Run all tests"
	@echo "  make test-api  — Run 91 API endpoint tests"
	@echo "  make db-shell  — PostgreSQL interactive shell"
	@echo "  make clean     — Remove all build artifacts"
