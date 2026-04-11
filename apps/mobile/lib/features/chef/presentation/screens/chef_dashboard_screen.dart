import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../config/providers.dart';

class ChefDashboardScreen extends ConsumerWidget {
  const ChefDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final theme = Theme.of(context);
    final name = user?['name'] as String? ?? 'Chef';

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: CustomScrollView(slivers: [
        // Hero header
        SliverAppBar(
          expandedHeight: 200,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: const BoxDecoration(
                  gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF6D28D9), Color(0xFF4C1D95)],
              )),
              child: SafeArea(
                  child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        const CircleAvatar(
                            radius: 22,
                            backgroundColor: Colors.white24,
                            child: Icon(Icons.person, color: Colors.white)),
                        const SizedBox(width: 12),
                        Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Good morning,',
                                  style: TextStyle(
                                      color: Colors.white.withOpacity(0.8),
                                      fontSize: 13)),
                              Text(name,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 20,
                                      fontWeight: FontWeight.w700)),
                            ]),
                        const Spacer(),
                        _OnlineToggle(),
                      ]),
                      const SizedBox(height: 20),
                      // Today's quick stats
                      const Row(children: [
                        _QuickStat(
                            label: "Today's Orders",
                            value: '12',
                            icon: Icons.receipt_long),
                        SizedBox(width: 12),
                        _QuickStat(
                            label: 'Revenue',
                            value: '1,840 EGP',
                            icon: Icons.payments),
                        SizedBox(width: 12),
                        _QuickStat(
                            label: 'Rating', value: '4.9 ⭐', icon: Icons.star),
                      ]),
                    ]),
              )),
            ),
          ),
          actions: [
            IconButton(
                icon: const Icon(Icons.notifications_outlined,
                    color: Colors.white),
                onPressed: () {}),
            IconButton(
                icon:
                    const Icon(Icons.chat_bubble_outline, color: Colors.white),
                onPressed: () => context.go('/chef/chat')),
          ],
        ),

        // Active Orders
        SliverToBoxAdapter(
            child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: Row(children: [
            Text('Active Orders',
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const Spacer(),
            GestureDetector(
                onTap: () => context.go('/chef/orders'),
                child: const Text('See all',
                    style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                        fontSize: 13))),
          ]),
        )),

        SliverList(
            delegate: SliverChildListDelegate([
          for (final o in _mockOrders)
            _ActiveOrderCard(order: o)
                .animate()
                .fadeIn(
                    delay: Duration(milliseconds: _mockOrders.indexOf(o) * 80))
                .slideY(begin: 0.1),
        ])),

        // Incoming requests
        SliverToBoxAdapter(
            child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
          child: Text('New Requests',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700)),
        )),
        SliverToBoxAdapter(child: _IncomingOrderCard()),

        // Today's schedule
        SliverToBoxAdapter(
            child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
          child: Text('Today\'s Schedule',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700)),
        )),
        SliverToBoxAdapter(child: _ScheduleTimeline()),
        const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
      ]),
    );
  }
}

class _OnlineToggle extends StatefulWidget {
  @override
  State<_OnlineToggle> createState() => _OnlineToggleState();
}

class _OnlineToggleState extends State<_OnlineToggle> {
  bool _isOnline = true;
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: () => setState(() => _isOnline = !_isOnline),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: _isOnline ? Colors.white.withOpacity(0.2) : Colors.black26,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withOpacity(0.4)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isOnline ? const Color(0xFF4ADE80) : Colors.grey)),
            const SizedBox(width: 6),
            Text(_isOnline ? 'Online' : 'Offline',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600)),
          ]),
        ),
      );
}

class _QuickStat extends StatelessWidget {
  final String label, value;
  final IconData icon;
  const _QuickStat(
      {required this.label, required this.value, required this.icon});
  @override
  Widget build(BuildContext context) => Expanded(
          child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          Icon(icon, color: Colors.white, size: 18),
          const SizedBox(height: 4),
          Text(value,
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 13)),
          Text(label,
              style:
                  TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 10),
              textAlign: TextAlign.center),
        ]),
      ));
}

final _mockOrders = [
  {
    'id': 'ORD-001',
    'meal': 'Egyptian Chicken Rice',
    'customer': 'Ahmed H.',
    'status': 'CHEF_PREPARING',
    'servings': 2,
    'time': '2:30 PM'
  },
  {
    'id': 'ORD-002',
    'meal': 'Pasta Alfredo',
    'customer': 'Sara M.',
    'status': 'INGREDIENTS_DELIVERED_TO_CHEF',
    'servings': 1,
    'time': '3:00 PM'
  },
];

class _ActiveOrderCard extends StatelessWidget {
  final Map<String, dynamic> order;
  const _ActiveOrderCard({required this.order});
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color,
          borderRadius: BorderRadius.circular(18),
          boxShadow: AppTheme_shadow(),
        ),
        child: Row(children: [
          Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                  color: AppColors.primary50,
                  borderRadius: BorderRadius.circular(14)),
              child:
                  const Icon(Icons.restaurant_menu, color: AppColors.primary)),
          const SizedBox(width: 12),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(order['meal'] as String,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 14)),
                Text('${order['customer']} • ${order['servings']} servings',
                    style:
                        const TextStyle(fontSize: 12, color: AppColors.muted)),
              ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                    color: const Color(0xFFDDD6FE),
                    borderRadius: BorderRadius.circular(8)),
                child: const Text('Preparing',
                    style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF6D28D9),
                        fontWeight: FontWeight.w600))),
            const SizedBox(height: 4),
            Text(order['time'] as String,
                style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ]),
        ]),
      );
}

// ignore: non_constant_identifier_names
List<BoxShadow> AppTheme_shadow() => [
      BoxShadow(
          color: Colors.black.withOpacity(0.05),
          blurRadius: 12,
          offset: const Offset(0, 3))
    ];

class _IncomingOrderCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.symmetric(horizontal: 20),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFF5F3FF), Color(0xFFEDE9FE)]),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFDDD6FE)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.notifications_active,
                color: Color(0xFF6D28D9), size: 20),
            const SizedBox(width: 8),
            const Text('New Order Request!',
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: Color(0xFF4C1D95))),
            const Spacer(),
            Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10)),
                child: const Text('3 min',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6D28D9)))),
          ]),
          const SizedBox(height: 12),
          const Text('Kofta Kit × 3 servings',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const Text('Customer: Omar K. • 4:00 PM delivery',
              style: TextStyle(fontSize: 12, color: AppColors.muted)),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
                child: OutlinedButton(
                    onPressed: () {},
                    style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        minimumSize: const Size(0, 42)),
                    child: const Text('Decline'))),
            const SizedBox(width: 10),
            Expanded(
                flex: 2,
                child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6D28D9),
                        minimumSize: const Size(0, 42)),
                    child: const Text('Accept Order'))),
          ]),
        ]),
      );
}

class _ScheduleTimeline extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.symmetric(horizontal: 20),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
            color: Theme.of(context).cardTheme.color,
            borderRadius: BorderRadius.circular(18),
            boxShadow: AppTheme_shadow()),
        child: Column(children: [
          for (final s in [
            ('10:00 AM', 'Chicken Rice prep', true),
            ('12:00 PM', 'Pasta Alfredo delivery', false),
            ('6:00 PM', 'Kofta Kit (incoming)', false)
          ])
            Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(children: [
                  Column(children: [
                    Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: s.$3
                                ? AppColors.primary
                                : AppColors.muted.withOpacity(0.3))),
                    if (s != ('6:00 PM', 'Kofta Kit (incoming)', false))
                      Container(
                          width: 2, height: 24, color: AppColors.borderLight),
                  ]),
                  const SizedBox(width: 12),
                  Text(s.$1,
                      style: TextStyle(
                          fontSize: 12,
                          color: AppColors.muted,
                          fontWeight:
                              s.$3 ? FontWeight.w600 : FontWeight.w400)),
                  const SizedBox(width: 12),
                  Text(s.$2,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: s.$3 ? FontWeight.w700 : FontWeight.w400,
                          color: s.$3
                              ? AppColors.primary
                              : AppColors.textPrimary)),
                ])),
        ]),
      );
}
