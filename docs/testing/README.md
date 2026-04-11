# Testing Guide

## API Tests
```bash
cd apps/api && npm test          # Unit
cd apps/api && npm run test:e2e  # E2E (needs Docker services)
```

## Flutter Tests
```bash
cd apps/mobile && flutter test                    # Unit + widget
cd apps/mobile && flutter test integration_test/  # Integration (needs device)
```

## Test Environment

### Android
1. Android Studio + SDK installed
2. Create AVD: Pixel 7, API 34
3. `cd apps/mobile && flutter run -d android`

### iOS (macOS only)
1. Xcode 15+ installed
2. Open Simulator: iPhone 15 Pro
3. `cd apps/mobile && flutter run -d ios`

### Both simultaneously
```bash
flutter run -d android  # Terminal 1
flutter run -d ios      # Terminal 2
```

## Seed Data
- 6 users (customer, chef, 2 stores, driver, admin)
- 3 meals with ingredients
- Product-ingredient mappings
- Zone + fee rules for Giza
- Dev OTP bypass: `000000`
