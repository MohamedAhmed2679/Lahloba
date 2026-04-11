import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class DeliveryEarningsScreen extends StatelessWidget {
  const DeliveryEarningsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Earnings')),
      body: SingleChildScrollView(
        child: Column(children: [
          // Hero earnings card
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF0EA5E9), Color(0xFF0284C7)]),
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Column(children: [
              Text('This Week',
                  style: TextStyle(color: Colors.white70, fontSize: 14)),
              SizedBox(height: 4),
              Text('1,320 EGP',
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 36)),
              SizedBox(height: 16),
              Divider(color: Colors.white24),
              SizedBox(height: 14),
              Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                _EarningsStat(label: 'Tasks', value: '31'),
                _EarningsStat(label: 'Distance', value: '112 km'),
                _EarningsStat(label: 'Bonuses', value: '180 EGP'),
                _EarningsStat(label: 'Rating', value: '4.92'),
              ]),
            ]),
          ),

          // Period selector
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              for (final p in ['Today', 'This Week', 'This Month'])
                Expanded(
                    child: Container(
                  margin:
                      const EdgeInsets.only(right: p != 'This Month' ? 8 : 0),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: p == 'This Week'
                        ? AppColors.driverColor
                        : AppColors.grey100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(p,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: p == 'This Week'
                              ? Colors.white
                              : AppColors.muted)),
                )),
            ]),
          ),

          const SizedBox(height: 20),
          // Daily breakdown
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(children: [
              Text('Daily Breakdown',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
              Spacer(),
              Text('Mar 22 – 29',
                  style: TextStyle(fontSize: 12, color: AppColors.muted)),
            ]),
          ),
          for (final d in _weekDays) _DayEarningsRow(day: d),
          const SizedBox(height: 24),

          // Payout button
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton.icon(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.driverColor,
                  minimumSize: const Size(double.infinity, 54)),
              icon:
                  const Icon(Icons.account_balance_wallet, color: Colors.white),
              label: const Text('Request Payout',
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 16)),
            ),
          ),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }
}

class _EarningsStat extends StatelessWidget {
  final String label, value;
  const _EarningsStat({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Column(children: [
        Text(value,
            style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 16)),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(color: Colors.white70, fontSize: 11)),
      ]);
}

final _weekDays = [
  ('Sat Mar 29', 320, 8),
  ('Fri Mar 28', 180, 4),
  ('Thu Mar 27', 240, 6),
  ('Wed Mar 26', 195, 5),
  ('Tue Mar 25', 145, 3),
  ('Mon Mar 24', 240, 5),
];

class _DayEarningsRow extends StatelessWidget {
  final (String, int, int) day;
  const _DayEarningsRow({required this.day});
  @override
  Widget build(BuildContext context) {
    final pct = day.$2 / 320.0; // max 320 for bar width
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 8,
                offset: const Offset(0, 2))
          ]),
      child: Row(children: [
        SizedBox(
            width: 90,
            child: Text(day.$1,
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w500))),
        const SizedBox(width: 8),
        Expanded(
            child: ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
              value: pct,
              backgroundColor: AppColors.driverColor.withOpacity(0.1),
              color: AppColors.driverColor,
              minHeight: 8),
        )),
        const SizedBox(width: 12),
        SizedBox(
            width: 60,
            child: Text('${day.$2} EGP',
                textAlign: TextAlign.right,
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.driverColor))),
        const SizedBox(width: 8),
        Text('${day.$3} tasks',
            style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      ]),
    );
  }
}
