import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../config/providers.dart';

class StoreDashboardScreen extends ConsumerWidget {
  const StoreDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final name = user?['name'] as String? ?? 'Store Owner';
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
                colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
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
                              Text('Store Dashboard',
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
                        Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                                color: Colors.white24,
                                borderRadius: BorderRadius.circular(16)),
                            child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.star,
                                      color: Colors.white, size: 16),
                                  SizedBox(width: 4),
                                  Text('4.8',
                                      style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700))
                                ])),
                      ]),
                      const SizedBox(height: 20),
                      // Stats row
                      const Row(children: [
                        _StatChip(label: "Today's Orders", value: '24'),
                        SizedBox(width: 8),
                        _StatChip(label: 'To Pack', value: '5'),
                        SizedBox(width: 8),
                        _StatChip(label: 'Revenue', value: '4,120 EGP'),
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
          ],
        ),

        // Urgent Action Banner
        SliverToBoxAdapter(
            child: Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
              color: AppColors.error.withOpacity(0.1),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.error.withOpacity(0.3))),
          child: Row(children: [
            const Icon(Icons.warning_amber_rounded,
                color: AppColors.error, size: 28),
            const SizedBox(width: 12),
            const Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text('Low Stock Alert',
                      style: TextStyle(
                          color: AppColors.error,
                          fontWeight: FontWeight.w700,
                          fontSize: 15)),
                  Text('3 items are running low on inventory.',
                      style: TextStyle(
                          color: AppColors.textPrimary, fontSize: 12)),
                ])),
            ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.error,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 16)),
                child: const Text('View',
                    style: TextStyle(fontWeight: FontWeight.w700))),
          ]),
        ).animate().fadeIn().slideY(begin: 0.1)),

        SliverToBoxAdapter(
            child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 8),
          child: Text('Packing Queue',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700)),
        )),
        SliverList(
            delegate: SliverChildListDelegate([
          for (final f in _fulfillmentQueue)
            _FulfillmentCard(fulfillment: f).animate().fadeIn(
                delay:
                    Duration(milliseconds: _fulfillmentQueue.indexOf(f) * 60)),
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
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          Text(value,
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 16)),
          const SizedBox(height: 2),
          Text(label,
              style:
                  TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 11),
              textAlign: TextAlign.center),
        ]),
      ));
}

final _fulfillmentQueue = [
  {
    'id': 'FUL-801',
    'items': 4,
    'chef': 'Chef Fatma',
    'driver': 'Ahmed',
    'eta': '10 min',
    'status': 'WAITING_PACKING',
    'amount': '240 EGP'
  },
  {
    'id': 'FUL-802',
    'items': 2,
    'chef': 'Chef Nour',
    'driver': 'Mahmoud',
    'eta': '25 min',
    'status': 'WAITING_PACKING',
    'amount': '150 EGP'
  },
];

class _FulfillmentCard extends StatelessWidget {
  final Map<String, dynamic> fulfillment;
  const _FulfillmentCard({required this.fulfillment});
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 8,
                offset: const Offset(0, 2))
          ],
          border: Border.all(color: AppColors.storeColor.withOpacity(0.3)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                    color: AppColors.amber50,
                    borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.inventory_2,
                    color: AppColors.storeColor, size: 20)),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Row(children: [
                    Text('Order ${fulfillment['id']}',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15)),
                    const Spacer(),
                    Text('${fulfillment['items']} items',
                        style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: AppColors.storeColor)),
                  ]),
                  const SizedBox(height: 2),
                  Text(
                      'For: ${fulfillment['chef']} • Driver ETA: ${fulfillment['eta']}',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.muted)),
                ])),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            Text(fulfillment['amount'] as String,
                style:
                    const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const Spacer(),
            ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.storeColor,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 40),
                  padding: const EdgeInsets.symmetric(horizontal: 20)),
              child: const Text('Start Packing'),
            ),
          ]),
        ]),
      );
}
