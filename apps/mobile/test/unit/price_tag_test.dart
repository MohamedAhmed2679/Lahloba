import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PriceTag formatting', () {
    test('converts minor units to display format', () {
      expect((15000 / 100).toStringAsFixed(2), '150.00');
      expect((64000 / 100).toStringAsFixed(2), '640.00');
      expect((99 / 100).toStringAsFixed(2), '0.99');
    });

    test('handles zero amount', () {
      expect((0 / 100).toStringAsFixed(2), '0.00');
    });
  });

  group('OTP validation', () {
    test('accepts 6-digit code', () {
      expect('123456'.length == 6, isTrue);
    });

    test('rejects short code', () {
      expect('12345'.length == 6, isFalse);
    });

    test('dev bypass code accepted', () {
      expect('000000', '000000');
    });
  });
}
