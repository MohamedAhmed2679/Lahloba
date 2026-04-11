import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';

/// Customer bottom navigation shell — 5 tabs like Talabat
class CustomerShell extends StatelessWidget {
  final Widget child;
  const CustomerShell({super.key, required this.child});

  int _indexOf(String loc) {
    if (loc.startsWith('/home')) return 0;
    if (loc.startsWith('/search')) return 1;
    if (loc.startsWith('/orders')) return 2;
    if (loc.startsWith('/chat')) return 3;
    if (loc.startsWith('/profile')) return 4;
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
                _NavItem(icon: Icons.home_rounded, label: 'Home', selected: idx == 0, onTap: () => context.go('/home')),
                _NavItem(icon: Icons.search_rounded, label: 'Search', selected: idx == 1, onTap: () => context.go('/search')),
                _NavItem(icon: Icons.receipt_long_rounded, label: 'Orders', selected: idx == 2, onTap: () => context.go('/orders')),
                _NavItem(icon: Icons.chat_bubble_outline_rounded, label: 'Chat', selected: idx == 3, onTap: () => context.go('/chat')),
                _NavItem(icon: Icons.person_outline_rounded, label: 'Profile', selected: idx == 4, onTap: () => context.go('/profile')),
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
  final VoidCallback onTap;
  const _NavItem({required this.icon, required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withOpacity(0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: selected ? AppColors.primary : AppColors.muted, size: 24),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 10, fontWeight: selected ? FontWeight.w700 : FontWeight.w400, color: selected ? AppColors.primary : AppColors.muted)),
        ]),
      ),
    );
  }
}
