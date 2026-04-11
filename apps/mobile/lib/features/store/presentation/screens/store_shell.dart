import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';

/// Store/Supplier navigation shell — 4 tabs
class StoreShell extends StatelessWidget {
  final Widget child;
  const StoreShell({super.key, required this.child});

  int _indexOf(String loc) {
    if (loc == '/store') return 0;
    if (loc.startsWith('/store/fulfillments')) return 1;
    if (loc.startsWith('/store/products')) return 2;
    if (loc.startsWith('/store/earnings')) return 3;
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
                _NavItem(icon: Icons.store_rounded, label: 'Dashboard', selected: idx == 0, color: AppColors.storeColor, onTap: () => context.go('/store')),
                _NavItem(icon: Icons.inventory_2_rounded, label: 'Orders', selected: idx == 1, color: AppColors.storeColor, onTap: () => context.go('/store/fulfillments')),
                _NavItem(icon: Icons.category_rounded, label: 'Products', selected: idx == 2, color: AppColors.storeColor, onTap: () => context.go('/store/products')),
                _NavItem(icon: Icons.payments_rounded, label: 'Earnings', selected: idx == 3, color: AppColors.storeColor, onTap: () => context.go('/store/earnings')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon; final String label; final bool selected; final Color color; final VoidCallback onTap;
  const _NavItem({required this.icon, required this.label, required this.selected, required this.color, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap, behavior: HitTestBehavior.opaque,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(color: selected ? color.withOpacity(0.1) : Colors.transparent, borderRadius: BorderRadius.circular(14)),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: selected ? color : AppColors.muted, size: 22),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 10, fontWeight: selected ? FontWeight.w700 : FontWeight.w400, color: selected ? color : AppColors.muted)),
      ]),
    ),
  );
}
