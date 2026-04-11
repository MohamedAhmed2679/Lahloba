import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../core/theme/app_colors.dart';

class ChefOrdersScreen extends StatefulWidget {
  const ChefOrdersScreen({super.key});
  @override
  State<ChefOrdersScreen> createState() => _ChefOrdersScreenState();
}

class _ChefOrdersScreenState extends State<ChefOrdersScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
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
        title: const Text('Chef Orders'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.muted,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'Active'),
            Tab(text: 'Incoming'),
            Tab(text: 'History')
          ],
        ),
      ),
      body: TabBarView(controller: _tabs, children: [
        _OrdersList(orders: _active),
        _IncomingList(),
        _OrdersList(orders: _history),
      ]),
    );
  }
}

final _active = [
  {
    'id': 'ORD-001',
    'meal': 'Egyptian Chicken Rice',
    'customer': 'Ahmed H.',
    'status': 'CHEF_PREPARING',
    'servings': 2,
    'time': '2:30 PM',
    'amount': '280 EGP'
  },
  {
    'id': 'ORD-002',
    'meal': 'Pasta Alfredo',
    'customer': 'Sara M.',
    'status': 'INGREDIENTS_DELIVERED_TO_CHEF',
    'servings': 1,
    'time': '3:00 PM',
    'amount': '120 EGP'
  },
];
final _history = [
  {
    'id': 'ORD-003',
    'meal': 'Kofta Kit',
    'customer': 'Omar K.',
    'status': 'DELIVERED',
    'servings': 3,
    'time': 'Yesterday',
    'amount': '300 EGP'
  },
  {
    'id': 'ORD-004',
    'meal': 'Molokhia',
    'customer': 'Layla R.',
    'status': 'DELIVERED',
    'servings': 4,
    'time': 'Yesterday',
    'amount': '200 EGP'
  },
];

const _statusConfig = {
  'CHEF_PREPARING': ('Preparing', Color(0xFFDDD6FE), Color(0xFF6D28D9)),
  'INGREDIENTS_DELIVERED_TO_CHEF': (
    'Ingredients In',
    Color(0xFFCCFBF1),
    Color(0xFF0D9488)
  ),
  'DELIVERED': ('Delivered', Color(0xFFDCFCE7), Color(0xFF16A34A)),
  'CONFIRMED': ('Confirmed', Color(0xFFDBEAFE), Color(0xFF2563EB)),
};

class _OrdersList extends StatelessWidget {
  final List<Map<String, dynamic>> orders;
  const _OrdersList({required this.orders});
  @override
  Widget build(BuildContext context) => ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _ChefOrderCard(order: orders[i])
            .animate()
            .fadeIn(delay: Duration(milliseconds: i * 60))
            .slideY(begin: 0.05),
      );
}

class _ChefOrderCard extends StatelessWidget {
  final Map<String, dynamic> order;
  const _ChefOrderCard({required this.order});
  @override
  Widget build(BuildContext context) {
    final sc = _statusConfig[order['status']] ??
        ('Unknown', AppColors.grey100, AppColors.muted);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 10,
              offset: const Offset(0, 2))
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(order['id'] as String,
              style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600)),
          const Spacer(),
          Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                  color: sc.$2, borderRadius: BorderRadius.circular(10)),
              child: Text(sc.$1,
                  style: TextStyle(
                      fontSize: 11,
                      color: sc.$3,
                      fontWeight: FontWeight.w600))),
        ]),
        const SizedBox(height: 10),
        Text(order['meal'] as String,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 4),
        Text(
            '${order['customer']} • ${order['servings']} servings • ${order['time']}',
            style: const TextStyle(fontSize: 13, color: AppColors.muted)),
        const SizedBox(height: 12),
        Row(children: [
          Text(order['amount'] as String,
              style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: AppColors.secondary)),
          const Spacer(),
          if (order['status'] == 'CHEF_PREPARING')
            ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                  minimumSize: const Size(0, 38),
                  padding: const EdgeInsets.symmetric(horizontal: 20)),
              child: const Text('Mark Ready'),
            ),
        ]),
      ]),
    );
  }
}

class _IncomingList extends StatelessWidget {
  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _IncomingOrderCard(
              meal: 'Kofta Kit',
              servings: 3,
              customer: 'Omar K.',
              time: '4:00 PM',
              amount: '300 EGP',
              minutesAgo: 2),
        ],
      );
}

class _IncomingOrderCard extends StatelessWidget {
  final String meal, customer, time, amount;
  final int servings, minutesAgo;
  const _IncomingOrderCard(
      {required this.meal,
      required this.servings,
      required this.customer,
      required this.time,
      required this.amount,
      required this.minutesAgo});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFF5F3FF), Color(0xFFEDE9FE)]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFDDD6FE), width: 1.5),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.notifications_active_rounded,
                color: Color(0xFF6D28D9), size: 22),
            const SizedBox(width: 8),
            const Text('New Order!',
                style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: Color(0xFF4C1D95))),
            const Spacer(),
            Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10)),
                child: Text('$minutesAgo min ago',
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6D28D9)))),
          ]),
          const Divider(height: 20),
          Text(meal,
              style:
                  const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          const SizedBox(height: 4),
          Text('$servings servings • $customer • $time',
              style: const TextStyle(fontSize: 13, color: AppColors.muted)),
          const SizedBox(height: 4),
          Text(amount,
              style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                  color: AppColors.secondary)),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
                child: OutlinedButton(
                    onPressed: () {},
                    style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        minimumSize: const Size(0, 48)),
                    child: const Text('Decline'))),
            const SizedBox(width: 10),
            Expanded(
                flex: 2,
                child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6D28D9),
                        minimumSize: const Size(0, 48)),
                    child: const Text('Accept'))),
          ]),
        ]),
      );
}
