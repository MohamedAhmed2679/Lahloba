import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

/// WCAG 2.1 AA compliant accessibility utilities for Lahloba
class A11y {
  A11y._();

  /// Minimum tap target size (48x48 dp per WCAG 2.1)
  static const double minTapTarget = 48.0;

  /// Wrap widget with minimum tap target
  static Widget tapTarget({required Widget child, VoidCallback? onTap, String? semanticLabel}) {
    return Semantics(
      label: semanticLabel,
      button: onTap != null,
      child: GestureDetector(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: minTapTarget, minHeight: minTapTarget),
          child: child,
        ),
      ),
    );
  }

  /// Check if contrast ratio meets AA standard (4.5:1 for normal, 3:1 for large)
  static bool meetsContrastAA(Color foreground, Color background, {bool isLargeText = false}) {
    final ratio = _contrastRatio(foreground, background);
    return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
  }

  /// Check AAA standard (7:1 for normal, 4.5:1 for large)
  static bool meetsContrastAAA(Color foreground, Color background, {bool isLargeText = false}) {
    final ratio = _contrastRatio(foreground, background);
    return isLargeText ? ratio >= 4.5 : ratio >= 7.0;
  }

  static double _contrastRatio(Color c1, Color c2) {
    final l1 = _relativeLuminance(c1);
    final l2 = _relativeLuminance(c2);
    final lighter = l1 > l2 ? l1 : l2;
    final darker = l1 > l2 ? l2 : l1;
    return (lighter + 0.05) / (darker + 0.05);
  }

  static double _relativeLuminance(Color color) {
    double r = color.red / 255.0;
    double g = color.green / 255.0;
    double b = color.blue / 255.0;
    r = r <= 0.03928 ? r / 12.92 : ((r + 0.055) / 1.055);
    g = g <= 0.03928 ? g / 12.92 : ((g + 0.055) / 1.055);
    b = b <= 0.03928 ? b / 12.92 : ((b + 0.055) / 1.055);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /// Screen reader announcement
  static void announce(BuildContext context, String message) {
    SemanticsService.announce(message, Directionality.of(context));
  }

  /// Focus-visible indicator
  static BoxDecoration focusDecoration({bool focused = false, double radius = 18}) {
    return BoxDecoration(
      borderRadius: BorderRadius.circular(radius),
      border: focused ? Border.all(color: const Color(0xFF0F766E), width: 3) : null,
    );
  }

  /// Semantic price label (e.g. "150 Egyptian pounds")
  static String priceLabel(int amountMinor, String currency) {
    final amount = (amountMinor / 100).toStringAsFixed(2);
    final currencyName = currency == 'EGP' ? 'Egyptian pounds' : currency;
    return '$amount $currencyName';
  }

  /// Semantic order status (human-friendly)
  static String orderStatusLabel(String status) {
    final map = {
      'CREATED': 'Order created',
      'CONFIRMED': 'Order confirmed',
      'INGREDIENTS_SOURCING': 'Sourcing ingredients from stores',
      'INGREDIENTS_DELIVERED_TO_CHEF': 'Ingredients delivered to chef',
      'CHEF_PREPARING': 'Chef is preparing your meal',
      'MEAL_READY': 'Meal is ready for pickup',
      'MEAL_ON_THE_WAY': 'Meal is on the way to you',
      'DELIVERED': 'Order delivered',
      'CANCELLED': 'Order cancelled',
    };
    return map[status] ?? status;
  }

  /// RTL-aware icon direction
  static IconData directionalIcon(BuildContext context, IconData ltrIcon, IconData rtlIcon) {
    return Directionality.of(context) == TextDirection.rtl ? rtlIcon : ltrIcon;
  }
}

/// Widget that scales text based on accessibility preferences
class ScalableText extends StatelessWidget {
  final String text;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;
  final TextAlign? textAlign;

  const ScalableText(this.text, {super.key, this.style, this.maxLines, this.overflow, this.textAlign});

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    return Text(
      text,
      style: style,
      maxLines: maxLines,
      overflow: overflow,
      textAlign: textAlign,
      textScaler: TextScaler.linear(mediaQuery.textScaler.scale(1.0).clamp(0.8, 2.0)),
    );
  }
}

/// Ensures all interactive elements have proper focus management
class FocusableCard extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final String? semanticLabel;

  const FocusableCard({super.key, required this.child, this.onTap, this.semanticLabel});

  @override
  State<FocusableCard> createState() => _FocusableCardState();
}

class _FocusableCardState extends State<FocusableCard> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: widget.semanticLabel,
      button: widget.onTap != null,
      child: Focus(
        onFocusChange: (f) => setState(() => _focused = f),
        child: GestureDetector(
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            decoration: A11y.focusDecoration(focused: _focused),
            child: widget.child,
          ),
        ),
      ),
    );
  }
}
