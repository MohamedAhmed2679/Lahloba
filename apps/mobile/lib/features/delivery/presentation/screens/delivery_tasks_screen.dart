import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../core/theme/app_colors.dart';

class DeliveryTasksScreen extends StatefulWidget {
  const DeliveryTasksScreen({super.key});
  @override
  State<DeliveryTasksScreen> createState() => _DeliveryTasksScreenState();
}

class _DeliveryTasksScreenState extends State<DeliveryTasksScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Delivery Tasks'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.driverColor,
          unselectedLabelColor: AppColors.muted,
          indicatorColor: AppColors.driverColor,
          tabs: const [Tab(text: 'Available'), Tab(text: 'My Tasks')],
        ),
      ),
      body: TabBarView(controller: _tabs, children: [
        _AvailableTasksList(),
        _MyTasksList(),
      ]),
    );
  }
}

final _availableTasks = [
  {
    'id': 'TK-053',
    'type': 'INGREDIENT_RUN',
    'stops': 3,
    'payout': 35,
    'km': 2.4,
    'bonus': 6,
    'pickupIn': 10
  },
  {
    'id': 'TK-054',
    'type': 'MEAL_RUN',
    'stops': 1,
    'payout': 25,
    'km': 1.8,
    'bonus': 0,
    'pickupIn': 5
  },
  {
    'id': 'TK-055',
    'type': 'INGREDIENT_RUN',
    'stops': 4,
    'payout': 45,
    'km': 3.2,
    'bonus': 8,
    'pickupIn': 15
  },
];

class _AvailableTasksList extends StatelessWidget {
  @override
  Widget build(BuildContext context) => ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _availableTasks.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _AvailableTaskCard(task: _availableTasks[i])
            .animate()
            .fadeIn(delay: Duration(milliseconds: i * 80)),
      );
}

class _AvailableTaskCard extends StatelessWidget {
  final Map<String, dynamic> task;
  const _AvailableTaskCard({required this.task});

  @override
  Widget build(BuildContext context) {
    final isIngr = task['type'] == 'INGREDIENT_RUN';
    final hasBonus = (task['bonus'] as int) > 0;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(18),
        border: hasBonus
            ? Border.all(
                color: AppColors.secondary.withOpacity(0.5), width: 1.5)
            : null,
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 2))
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                  color: isIngr ? AppColors.amber100 : AppColors.primary100,
                  borderRadius: BorderRadius.circular(10)),
              child: Text(isIngr ? '🛒 Ingredient Run' : '🍱 Meal Run',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: isIngr
                          ? AppColors.secondaryDark
                          : AppColors.primaryDark))),
          if (hasBonus) ...[
            const SizedBox(width: 8),
            Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                    color: AppColors.amber50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: AppColors.secondary.withOpacity(0.3))),
                child: Text('+${task['bonus']} EGP bonus',
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.secondaryDark))),
          ],
          const Spacer(),
          Text('${task['payout']} EGP',
              style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: AppColors.primary)),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          const Icon(Icons.pin_drop_outlined, size: 16, color: AppColors.muted),
          const SizedBox(width: 4),
          Text('${task['stops']} stops · ${task['km']} km',
              style: const TextStyle(fontSize: 13, color: AppColors.muted)),
          const Spacer(),
          const Icon(Icons.access_time, size: 14, color: AppColors.muted),
          const SizedBox(width: 4),
          Text('Pickup in ${task['pickupIn']} min',
              style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
              child: OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 44),
                      foregroundColor: AppColors.muted),
                  child: const Text('Skip'))),
          const SizedBox(width: 10),
          Expanded(
              flex: 2,
              child: ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.driverColor,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(0, 44)),
                  child: const Text('Accept Task'))),
        ]),
      ]),
    );
  }
}

class _MyTasksList extends StatelessWidget {
  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _AssignedTaskCard(
              id: 'TK-051',
              type: 'INGREDIENT_RUN',
              status: 'IN_PROGRESS',
              currentStop: 2,
              totalStops: 3,
              payout: 35),
        ],
      );
}

class _AssignedTaskCard extends StatelessWidget {
  final String id, type, status;
  final int currentStop, totalStops, payout;
  const _AssignedTaskCard(
      {required this.id,
      required this.type,
      required this.status,
      required this.currentStop,
      required this.totalStops,
      required this.payout});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.driverColor.withOpacity(0.1),
                AppColors.driverColor.withOpacity(0.05)
              ]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: AppColors.driverColor.withOpacity(0.3), width: 1.5),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.delivery_dining,
                color: AppColors.driverColor, size: 22),
            const SizedBox(width: 8),
            Text('Active Run • $id',
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: AppColors.driverColor)),
            const Spacer(),
            Text('$payout EGP',
                style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                    color: AppColors.driverColor)),
          ]),
          const SizedBox(height: 12),
          // Progress
          Row(children: [
            Text('Stop $currentStop / $totalStops',
                style:
                    const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(width: 12),
            Expanded(
                child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                  value: currentStop / totalStops,
                  backgroundColor: AppColors.driverColor.withOpacity(0.15),
                  color: AppColors.driverColor,
                  minHeight: 8),
            )),
          ]),
          const SizedBox(height: 14),
          ElevatedButton.icon(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.driverColor,
                minimumSize: const Size(double.infinity, 48)),
            icon: const Icon(Icons.navigation_rounded, color: Colors.white),
            label: const Text('Navigate to Next Stop',
                style: TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ]),
      );
}
