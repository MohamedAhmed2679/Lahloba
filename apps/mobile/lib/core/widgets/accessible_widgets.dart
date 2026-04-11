import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';

/// Primary CTA button with full accessibility support
class LahlobaButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool destructive;
  final IconData? icon;

  const LahlobaButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.destructive = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final isReducedMotion = MediaQuery.of(context).disableAnimations;
    return Semantics(
      button: true,
      enabled: onPressed != null && !loading,
      label: loading ? '$label, loading' : label,
      child: AnimatedContainer(
        duration:
            isReducedMotion ? Duration.zero : const Duration(milliseconds: 120),
        child: ElevatedButton(
          onPressed: loading ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: destructive ? AppColors.error : AppColors.primary,
            minimumSize:
                const Size(double.infinity, 52), // Exceeds 48dp minimum
          ),
          child: loading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : icon != null
                  ? Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(icon, size: 20),
                      const SizedBox(width: 8),
                      Text(label)
                    ])
                  : Text(label),
        ),
      ),
    );
  }
}

/// Price tag with tabular lining numerals
class PriceTag extends StatelessWidget {
  final int amountMinor;
  final String currency;
  final bool large;

  const PriceTag(
      {super.key,
      required this.amountMinor,
      this.currency = 'EGP',
      this.large = false});

  @override
  Widget build(BuildContext context) {
    final display = (amountMinor / 100).toStringAsFixed(2);
    return Semantics(
      label: '$display $currency',
      child: Text(
        '$display $currency',
        style: TextStyle(
          fontWeight: FontWeight.bold,
          fontSize: large ? 22 : 14,
          color: AppColors.secondary,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}

/// Status pill with accessible color + label
class StatusPill extends StatelessWidget {
  final String status;
  const StatusPill({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final label = status.replaceAll('_', ' ');
    final (Color bg, Color fg) = switch (status) {
      'DELIVERED' => (AppColors.success.withOpacity(0.1), AppColors.success),
      'CANCELLED' => (AppColors.error.withOpacity(0.1), AppColors.error),
      'MEAL_ON_THE_WAY' || 'MEAL_READY' => (
          AppColors.primary.withOpacity(0.1),
          AppColors.primary
        ),
      'CHEF_PREPARING' => (
          AppColors.secondary.withOpacity(0.1),
          AppColors.secondary
        ),
      _ => (AppColors.muted.withOpacity(0.1), AppColors.muted),
    };

    return Semantics(
      label: 'Status: $label',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
        child: Text(label,
            style: TextStyle(
                color: fg, fontSize: 12, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

/// OTP input with full a11y
class AccessibleOtpInput extends StatelessWidget {
  final int length;
  final ValueChanged<String> onCompleted;

  const AccessibleOtpInput(
      {super.key, this.length = 6, required this.onCompleted});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Enter $length digit verification code',
      textField: true,
      child: TextField(
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        autofillHints: const [AutofillHints.oneTimeCode],
        style: const TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          letterSpacing: 10,
        ),
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(length),
        ],
        decoration: InputDecoration(
          counterText: '',
          hintText: List.filled(length, '0').join(' '),
          filled: true,
          fillColor: AppColors.grey100,
        ),
        onChanged: (value) {
          if (value.length == length) {
            onCompleted(value);
          }
        },
      ),
    );
  }
}

/// Card with elevation adapting to theme
class LahlobaCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final String? semanticLabel;

  const LahlobaCard(
      {super.key, required this.child, this.onTap, this.semanticLabel});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      label: semanticLabel,
      button: onTap != null,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Theme.of(context).cardTheme.color,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(isDark ? 0.3 : 0.06),
                blurRadius: isDark ? 12 : 8,
                offset: const Offset(0, 2),
              )
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}
