import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class ChefAnalyticsScreen extends StatelessWidget {
  const ChefAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Insights'), actions: [
        TextButton(onPressed: () {}, child: const Text('30 days')),
      ]),
      body: SingleChildScrollView(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // KPI row
        const Row(children: [
          Expanded(child: _KPI('Orders', '48', '+12%', AppColors.primary50)),
          SizedBox(width: 12),
          Expanded(child: _KPI('Revenue', '7,200 EGP', '+8%', AppColors.amber50)),
        ]),
        const SizedBox(height: 12),
        const Row(children: [
          Expanded(child: _KPI('Avg Rating', '4.8', '+0.1', AppColors.lime50)),
          SizedBox(width: 12),
          Expanded(child: _KPI('Avg Prep', '32 min', '-3 min', AppColors.primary50)),
        ]),

        const SizedBox(height: 24),
        Text('Top Meals', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        for (final m in [('Egyptian Chicken Rice', 22, 4.9), ('Pasta Alfredo', 15, 4.5), ('Kofta Kit', 11, 4.6)])
          Container(
            margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Theme.of(context).cardTheme.color, borderRadius: BorderRadius.circular(14)),
            child: Row(children: [
              Expanded(child: Text(m.$1, style: const TextStyle(fontWeight: FontWeight.w600))),
              Text('${m.$2} orders', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
              const SizedBox(width: 12),
              const Icon(Icons.star, size: 14, color: AppColors.secondary),
              Text(' ${m.$3}', style: const TextStyle(fontSize: 13)),
            ]),
          ),

        const SizedBox(height: 24),
        Text('Peak Hours', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        // Simple bar chart
        SizedBox(height: 120, child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          for (final h in [(12, 0.4), (13, 0.7), (14, 0.5), (18, 0.6), (19, 1.0), (20, 0.9), (21, 0.6)])
            Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
              Container(height: 80 * h.$2, decoration: BoxDecoration(color: h.$2 == 1.0 ? AppColors.primary : AppColors.primary.withOpacity(0.4), borderRadius: const BorderRadius.vertical(top: Radius.circular(6)))),
              const SizedBox(height: 4),
              Text('${h.$1}', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
            ]))),
        ])),
      ])),
    );
  }
}

class _KPI extends StatelessWidget {
  final String label, value, delta; final Color bg;
  const _KPI(this.label, this.value, this.delta, this.bg);
  @override Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(18)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
      const SizedBox(height: 4),
      Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
      Text(delta, style: TextStyle(fontSize: 11, color: delta.startsWith('+') ? AppColors.success : AppColors.error)),
    ]),
  );
}
