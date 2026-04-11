import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class LoyaltyScreen extends StatelessWidget {
  const LoyaltyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Rewards')),
      body: SingleChildScrollView(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Tier card
        Container(
          width: double.infinity, padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [AppColors.primary, Color(0xFF0D9488)]),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.stars, color: Colors.amber, size: 28),
              const SizedBox(width: 8),
              Text('Silver Member', style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 14)),
            ]),
            const SizedBox(height: 16),
            const Text('2,350', style: TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold)),
            const Text('Available Points', style: TextStyle(color: Colors.white70, fontSize: 14)),
            const SizedBox(height: 16),
            // Progress to next tier
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: const LinearProgressIndicator(value: 2350 / 5000, backgroundColor: Colors.white24, color: AppColors.secondary, minHeight: 6),
            ),
            const SizedBox(height: 8),
            Text('2,650 points to Gold', style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 12)),
          ]),
        ),
        const SizedBox(height: 24),

        // Quick actions
        const Row(children: [
          Expanded(child: _ActionCard(icon: Icons.history, label: 'History', color: AppColors.primary50)),
          SizedBox(width: 12),
          Expanded(child: _ActionCard(icon: Icons.share, label: 'Refer', color: AppColors.amber50)),
          SizedBox(width: 12),
          Expanded(child: _ActionCard(icon: Icons.info_outline, label: 'Tiers', color: AppColors.lime50)),
        ]),
        const SizedBox(height: 24),

        // Rewards
        const Text('Available Rewards', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        const SizedBox(height: 12),
        const _RewardCard(name: '10% Off Next Order', points: 500, type: 'DISCOUNT_PERCENT', canAfford: true),
        const _RewardCard(name: 'Free Delivery', points: 300, type: 'FREE_DELIVERY', canAfford: true),
        const _RewardCard(name: '50 EGP Off', points: 1000, type: 'DISCOUNT_FIXED', canAfford: true),
        const _RewardCard(name: 'Exclusive Chef Access', points: 5000, type: 'EXCLUSIVE', canAfford: false),

        const SizedBox(height: 24),
        // Recent transactions
        const Text('Recent Activity', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        const SizedBox(height: 12),
        const _TxnRow('+28 points', 'Order #ord_10042', 'Earned', true),
        const _TxnRow('+15 points', 'Order #ord_10041', 'Earned', true),
        const _TxnRow('-300 points', 'Free Delivery Reward', 'Redeemed', false),
        const _TxnRow('+50 points', 'Rating bonus', 'Earned', true),
      ])),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon; final String label; final Color color;
  const _ActionCard({required this.icon, required this.label, required this.color});
  @override Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(18)),
    child: Column(children: [Icon(icon, color: AppColors.primary), const SizedBox(height: 6), Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500))]),
  );
}

class _RewardCard extends StatelessWidget {
  final String name; final int points; final String type; final bool canAfford;
  const _RewardCard({required this.name, required this.points, required this.type, required this.canAfford});
  @override Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10), padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(border: Border.all(color: canAfford ? AppColors.primary.withOpacity(0.3) : AppColors.borderLight), borderRadius: BorderRadius.circular(14)),
    child: Row(children: [
      Container(width: 44, height: 44, decoration: BoxDecoration(color: canAfford ? AppColors.primary50 : const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)),
        child: Icon(type == 'FREE_DELIVERY' ? Icons.local_shipping : type == 'EXCLUSIVE' ? Icons.workspace_premium : Icons.local_offer, color: canAfford ? AppColors.primary : AppColors.muted, size: 22)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(name, style: TextStyle(fontWeight: FontWeight.w600, color: canAfford ? null : AppColors.muted)),
        Text('$points points', style: TextStyle(fontSize: 13, color: canAfford ? AppColors.secondary : AppColors.muted)),
      ])),
      ElevatedButton(
        onPressed: canAfford ? () {} : null,
        style: ElevatedButton.styleFrom(minimumSize: const Size(80, 48), padding: EdgeInsets.zero, textStyle: const TextStyle(fontSize: 13)),
        child: const Text('Redeem'),
      ),
    ]),
  );
}

class _TxnRow extends StatelessWidget {
  final String points, desc, type; final bool earned;
  const _TxnRow(this.points, this.desc, this.type, this.earned);
  @override Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(children: [
      Container(width: 36, height: 36, decoration: BoxDecoration(color: earned ? AppColors.lime50 : AppColors.coral50, shape: BoxShape.circle),
        child: Icon(earned ? Icons.add : Icons.remove, size: 18, color: earned ? AppColors.success : AppColors.error)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(desc, style: const TextStyle(fontSize: 14)), Text(type, style: const TextStyle(fontSize: 12, color: AppColors.muted))])),
      Text(points, style: TextStyle(fontWeight: FontWeight.bold, color: earned ? AppColors.success : AppColors.error)),
    ]),
  );
}
