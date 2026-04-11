import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Primary CTA button with 120ms press animation
class LahlobaButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool destructive;
  final bool outlined;

  const LahlobaButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.destructive = false,
    this.outlined = false,
  });

  @override
  Widget build(BuildContext context) {
    if (outlined) {
      return OutlinedButton(
        onPressed: loading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: destructive ? AppColors.error : AppColors.primary,
          side: BorderSide(color: destructive ? AppColors.error : AppColors.primary, width: 1.5),
        ),
        child: _content(),
      );
    }
    return ElevatedButton(
      onPressed: loading ? null : onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: destructive ? AppColors.error : AppColors.primary,
      ),
      child: _content(),
    );
  }

  Widget _content() => loading
      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
      : Text(label);
}

/// Price tag with amber highlight
class PriceTag extends StatelessWidget {
  final int amountMinor;
  final String currency;
  final double fontSize;

  const PriceTag({super.key, required this.amountMinor, this.currency = 'EGP', this.fontSize = 16});

  @override
  Widget build(BuildContext context) {
    final formatted = (amountMinor / 100).toStringAsFixed(2);
    return Text(
      '$formatted $currency',
      style: TextStyle(
        fontWeight: FontWeight.bold,
        color: AppColors.secondary,
        fontSize: fontSize,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}

/// Status chip with role-appropriate colors
class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _colors();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }

  (Color, Color) _colors() => switch (status) {
    'CREATED' || 'PENDING' => (const Color(0xFFE2E8F0), AppColors.textLight),
    'CONFIRMED' || 'ASSIGNED' => (const Color(0xFFDBEAFE), const Color(0xFF1D4ED8)),
    'INGREDIENTS_SOURCING' || 'IN_PROGRESS' || 'PACKING' => (AppColors.amber100, const Color(0xFFD97706)),
    'CHEF_PREPARING' || 'READY_FOR_PICKUP' => (AppColors.primary100, AppColors.primary),
    'MEAL_READY' || 'MEAL_ON_THE_WAY' => (const Color(0xFFEDE9FE), const Color(0xFF7C3AED)),
    'DELIVERED' || 'COMPLETED' || 'SUCCEEDED' => (AppColors.lime50, AppColors.success),
    'CANCELLED' || 'FAILED' => (AppColors.coral50, AppColors.error),
    _ => (const Color(0xFFF1F5F9), AppColors.muted),
  };
}

/// Toast/Snackbar helper
class LahlobaToast {
  static void show(BuildContext context, String message, {bool isError = false, bool isSuccess = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: isError ? AppColors.error : isSuccess ? AppColors.success : AppColors.textLight,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      duration: const Duration(milliseconds: 3500),
      margin: const EdgeInsets.all(16),
    ));
  }
}

/// Section header used throughout the app
class SectionHeader extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const SectionHeader({super.key, required this.title, this.actionLabel, this.onAction});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
      child: Row(children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
        const Spacer(),
        if (actionLabel != null)
          TextButton(onPressed: onAction, child: Text(actionLabel!, style: const TextStyle(fontSize: 13))),
      ]),
    );
  }
}

/// Shimmer loading placeholder
class ShimmerBox extends StatelessWidget {
  final double width, height;
  final double radius;

  const ShimmerBox({super.key, required this.width, required this.height, this.radius = 18});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.muted.withOpacity(0.15),
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// Empty state placeholder
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;

  const EmptyState({super.key, required this.icon, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Center(child: Padding(
      padding: const EdgeInsets.all(48),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 64, color: AppColors.muted.withOpacity(0.4)),
        const SizedBox(height: 16),
        Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(subtitle!, style: const TextStyle(color: AppColors.muted), textAlign: TextAlign.center),
        ],
      ]),
    ));
  }
}
