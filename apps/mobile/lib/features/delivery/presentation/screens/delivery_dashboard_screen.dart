import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../config/providers.dart';

class DeliveryDashboardScreen extends ConsumerStatefulWidget {
  const DeliveryDashboardScreen({super.key});
  @override
  ConsumerState<DeliveryDashboardScreen> createState() =>
      _DeliveryDashboardScreenState();
}

class _DeliveryDashboardScreenState
    extends ConsumerState<DeliveryDashboardScreen> {
  bool _isOnline = false;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final name = user?['name'] as String? ?? 'Driver';
    final theme = Theme.of(context);

    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverAppBar(
          expandedHeight: 220,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: const BoxDecoration(
                  gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF0EA5E9), Color(0xFF0284C7)],
              )),
              child: SafeArea(
                  child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Welcome back,',
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
                        // Online toggle
                        GestureDetector(
                          onTap: () => setState(() => _isOnline = !_isOnline),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 350),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 10),
                            decoration: BoxDecoration(
                              color: _isOnline
                                  ? const Color(0xFF4ADE80)
                                  : Colors.white24,
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(
                                  color: Colors.white.withOpacity(0.4)),
                            ),
                            child:
                                Row(mainAxisSize: MainAxisSize.min, children: [
                              Icon(Icons.circle,
                                  size: 10,
                                  color: _isOnline
                                      ? Colors.white
                                      : Colors.white54),
                              const SizedBox(width: 6),
                              Text(_isOnline ? 'Online' : 'Go Online',
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14)),
                            ]),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 20),
                      // Stats row
                      const Row(children: [
                        _StatChip(label: 'Today', value: '6 tasks'),
                        SizedBox(width: 8),
                        _StatChip(label: 'Earnings', value: '270 EGP'),
                        SizedBox(width: 8),
                        _StatChip(label: 'Distance', value: '24.6 km'),
                        SizedBox(width: 8),
                        _StatChip(label: 'Rating', value: '4.92 ⭐'),
                      ]),
                    ]),
              )),
            ),
          ),
        ),

        // Available task banner
        if (_isOnline)
          SliverToBoxAdapter(
              child: _AvailableTaskBanner()
                  .animate()
                  .fadeIn()
                  .slideY(begin: -0.1)),

        SliverToBoxAdapter(
            child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: Text('Today\'s Summary',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700)),
        )),
        SliverToBoxAdapter(child: _TodaySummaryGrid()),

        SliverToBoxAdapter(
            child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
          child: Text('Recent Tasks',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700)),
        )),
        SliverList(
            delegate: SliverChildListDelegate([
          for (final t in _recentTasks)
            _TaskCard(task: t).animate().fadeIn(
                delay: Duration(milliseconds: _recentTasks.indexOf(t) * 60)),
        ])),
        const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
      ]),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label, value;
  const _StatChip({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Expanded(
          child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(12)),
        child: Column(children: [
          Text(value,
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 12)),
          Text(label,
              style: TextStyle(
                  color: Colors.white.withOpacity(0.7), fontSize: 10)),
        ]),
      ));
}

class _AvailableTaskBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
              colors: [Color(0xFF0EA5E9), Color(0xFF38BDF8)]),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(children: [
          const Icon(Icons.local_shipping_rounded,
              color: Colors.white, size: 32),
          const SizedBox(width: 12),
          const Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text('3 Tasks Available Nearby!',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15)),
                Text('Tap to view and accept tasks',
                    style: TextStyle(color: Colors.white70, fontSize: 12)),
              ])),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF0284C7),
                minimumSize: const Size(0, 36),
                padding: const EdgeInsets.symmetric(horizontal: 16)),
            child: const Text('View',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ]),
      );
}

class _TodaySummaryGrid extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.6,
          children: const [
            _SummaryCard(
                title: 'Completed',
                value: '6',
                icon: Icons.check_circle,
                color: AppColors.success),
            _SummaryCard(
                title: 'Earnings',
                value: '270 EGP',
                icon: Icons.payments,
                color: AppColors.secondary),
            _SummaryCard(
                title: 'Avg Time',
                value: '22 min',
                icon: Icons.timer,
                color: AppColors.driverColor),
            _SummaryCard(
                title: 'Distance',
                value: '24.6 km',
                icon: Icons.route,
                color: AppColors.primary),
          ],
        ),
      );
}

class _SummaryCard extends StatelessWidget {
  final String title, value;
  final IconData icon;
  final Color color;
  const _SummaryCard(
      {required this.title,
      required this.value,
      required this.icon,
      required this.color});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: Theme.of(context).cardTheme.color,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2))
            ]),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 24),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(value,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 18)),
                Text(title,
                    style:
                        const TextStyle(fontSize: 12, color: AppColors.muted)),
              ]),
            ]),
      );
}

final _recentTasks = [
  {
    'type': 'MEAL_RUN',
    'id': 'TK-042',
    'from': 'Chef Fatma',
    'to': 'Ahmed H.',
    'amount': '45 EGP',
    'status': 'COMPLETED',
    'km': '2.1 km'
  },
  {
    'type': 'INGREDIENT_RUN',
    'id': 'TK-041',
    'from': 'Metro Market',
    'to': 'Chef Nour',
    'amount': '30 EGP',
    'status': 'COMPLETED',
    'km': '1.8 km'
  },
];

class _TaskCard extends StatelessWidget {
  final Map<String, dynamic> task;
  const _TaskCard({required this.task});
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: Theme.of(context).cardTheme.color,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2))
            ]),
        child: Row(children: [
          Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                  color: task['type'] == 'MEAL_RUN'
                      ? AppColors.primary50
                      : AppColors.amber50,
                  borderRadius: BorderRadius.circular(12)),
              child: Icon(
                  task['type'] == 'MEAL_RUN'
                      ? Icons.delivery_dining
                      : Icons.shopping_basket,
                  color: task['type'] == 'MEAL_RUN'
                      ? AppColors.primary
                      : AppColors.secondary,
                  size: 22)),
          const SizedBox(width: 12),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text('${task['from']} → ${task['to']}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13)),
                Text('${task['id']} • ${task['km']}',
                    style:
                        const TextStyle(fontSize: 11, color: AppColors.muted)),
              ])),
          Text(task['amount'] as String,
              style: const TextStyle(
                  fontWeight: FontWeight.w700, color: AppColors.primary)),
        ]),
      );
}
