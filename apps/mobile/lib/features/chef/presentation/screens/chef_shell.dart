import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';

/// Chef navigation shell — 5 tabs for kitchen management
class ChefShell extends StatelessWidget {
  final Widget child;
  const ChefShell({super.key, required this.child});

  int _indexOf(String loc) {
    if (loc == '/chef') return 0;
    if (loc.startsWith('/chef/orders')) return 1;
    if (loc.startsWith('/chef/meals')) return 2;
    if (loc.startsWith('/chef/availability')) return 3;
    if (loc.startsWith('/chef/analytics')) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).uri.toString();
    final idx = _indexOf(loc);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).bottomNavigationBarTheme.backgroundColor ?? Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10, offset: const Offset(0, -2))],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _NavItem(icon: Icons.dashboard_rounded, label: 'Dashboard', selected: idx == 0, color: AppColors.chefColor, onTap: () => context.go('/chef')),
                _NavItem(icon: Icons.receipt_long_rounded, label: 'Orders', selected: idx == 1, color: AppColors.chefColor, onTap: () => context.go('/chef/orders')),
                _NavItem(icon: Icons.restaurant_menu_rounded, label: 'Meals', selected: idx == 2, color: AppColors.chefColor, onTap: () => context.go('/chef/meals')),
                _NavItem(icon: Icons.calendar_month_rounded, label: 'Schedule', selected: idx == 3, color: AppColors.chefColor, onTap: () => context.go('/chef/availability')),
                _NavItem(icon: Icons.bar_chart_rounded, label: 'Analytics', selected: idx == 4, color: AppColors.chefColor, onTap: () => context.go('/chef/analytics')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;
  const _NavItem({required this.icon, required this.label, required this.selected, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? color.withOpacity(0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: selected ? color : AppColors.muted, size: 22),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 10, fontWeight: selected ? FontWeight.w700 : FontWeight.w400, color: selected ? color : AppColors.muted)),
        ]),
      ),
    );
  }
}
