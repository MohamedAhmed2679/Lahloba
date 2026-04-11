# Deployment Guide

## Local Dev
```bash
cp .env.example .env
docker compose up -d           # Postgres, Redis, Kafka, MinIO, MailHog
psql $DATABASE_URL < packages/db/migrations/001_init.sql
psql $DATABASE_URL < packages/db/seeds/seed.sql
cd apps/api && npm install && npm run dev
cd apps/realtime-gateway && npm install && npm run dev
cd apps/mobile && flutter pub get && flutter run
```

## Android Release Build
```bash
cd apps/mobile
flutter build apk --release    # APK
flutter build appbundle         # AAB for Play Store
```

## iOS Release Build
```bash
cd apps/mobile
flutter build ios --release     # Then archive in Xcode
```

## Docker
```bash
docker build -t lahloba/api apps/api
```

## Production Checklist
- [ ] Strong JWT_SECRET (32+ chars)
- [ ] Real payment provider configured
- [ ] FCM/APNs credentials set
- [ ] S3 storage configured
- [ ] SSL/TLS enabled
- [ ] Monitoring (Prometheus + Grafana)
- [ ] Database backups scheduled
- [ ] Load testing completed
