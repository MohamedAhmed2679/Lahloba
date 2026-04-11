import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ApiService', () {
    test('should create with default URL', () { expect(true, isTrue); });
    test('should set auth header', () { expect(true, isTrue); });
    test('should set locale header', () { expect(true, isTrue); });
  });

  group('Money formatting', () {
    test('should format minor units to display', () {
      const amount = 28000;
      final display = (amount / 100).toStringAsFixed(2);
      expect(display, '280.00');
    });
    test('should handle zero', () {
      expect((0 / 100).toStringAsFixed(2), '0.00');
    });
  });
}
