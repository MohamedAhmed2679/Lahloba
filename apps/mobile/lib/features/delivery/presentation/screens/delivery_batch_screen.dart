import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class DeliveryBatchScreen extends StatelessWidget {
  const DeliveryBatchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Batch Delivery')),
      body: Column(children: [
        // Map area placeholder
        Expanded(flex: 2, child: Container(color: AppColors.primary50, child: const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.map, size: 48, color: AppColors.primary), SizedBox(height: 8), Text('Optimized Route Map', style: TextStyle(color: AppColors.muted)),
        ])))),
        // Batched tasks
        Expanded(flex: 3, child: Container(
          decoration: BoxDecoration(color: Theme.of(context).scaffoldBackgroundColor, borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
          child: SingleChildScrollView(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Text('3 Tasks Batched', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
              const Spacer(),
              Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: AppColors.success.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                child: const Text('+6 EGP bonus', style: TextStyle(color: AppColors.success, fontWeight: FontWeight.bold, fontSize: 12))),
            ]),
            const SizedBox(height: 4),
            const Text('Total: 45 EGP payout • 8.2 km', style: TextStyle(color: AppColors.muted, fontSize: 13)),
            const SizedBox(height: 16),
            // Optimized stops
            for (var i = 0; i < 5; i++)
              _Stop(
                seq: i + 1,
                type: i < 3 ? 'STORE' : i == 3 ? 'CHEF' : 'CUSTOMER',
                name: ['Metro Market', 'Fresh Corner', 'Al-Nour Store', 'Chef Fatma (dropoff)', 'Customer Ahmed'][i],
                distance: ['1.2 km', '0.8 km', '1.5 km', '2.1 km', '2.6 km'][i],
                isLast: i == 4,
              ),
            const SizedBox(height: 20),
            ElevatedButton(onPressed: () {}, child: const Text('Accept Batch')),
          ])),
        )),
      ]),
    );
  }
}

class _Stop extends StatelessWidget {
  final int seq; final String type, name, distance; final bool isLast;
  const _Stop({required this.seq, required this.type, required this.name, required this.distance, this.isLast = false});
  @override Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Column(children: [
      Container(width: 28, height: 28, decoration: BoxDecoration(color: type == 'STORE' ? AppColors.secondary : type == 'CHEF' ? AppColors.primary : AppColors.success, shape: BoxShape.circle),
        child: Center(child: Text('$seq', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)))),
      if (!isLast) Container(width: 2, height: 32, color: AppColors.borderLight),
    ]),
    const SizedBox(width: 12),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
        const Spacer(),
        Text(distance, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
      ]),
      Text(type == 'STORE' ? 'Pickup' : type == 'CHEF' ? 'Dropoff to chef' : 'Final delivery', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
      SizedBox(height: isLast ? 0 : 16),
    ])),
  ]);
}
