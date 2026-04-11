import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class StoreProductsScreen extends StatelessWidget {
  const StoreProductsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text('Inventory'),
          actions: [IconButton(icon: const Icon(Icons.add), onPressed: () {})]),
      body: CustomScrollView(slivers: [
        SliverToBoxAdapter(
            child: Padding(
                padding: const EdgeInsets.all(16),
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Search products...',
                    prefixIcon: const Icon(Icons.search),
                    filled: true,
                    fillColor: Theme.of(context).cardTheme.color,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none),
                  ),
                ))),
        SliverList(
            delegate: SliverChildListDelegate([
          for (final p in _products) _ProductItem(product: p),
        ])),
      ]),
    );
  }
}

final _products = [
  {
    'name': 'Whole Chicken (1.2kg)',
    'price': '130',
    'stock': 12,
    'category': 'Meat & Poultry'
  },
  {
    'name': 'Basmati Rice (1kg)',
    'price': '65',
    'stock': 45,
    'category': 'Pantry'
  },
  {
    'name': 'Fresh Tomatoes (1kg)',
    'price': '15',
    'stock': 0,
    'category': 'Produce'
  },
  {
    'name': 'Olive Oil (500ml)',
    'price': '220',
    'stock': 8,
    'category': 'Pantry'
  },
];

class _ProductItem extends StatelessWidget {
  final Map<String, dynamic> product;
  const _ProductItem({required this.product});

  @override
  Widget build(BuildContext context) {
    final stock = product['stock'] as int;
    final inStock = stock > 0;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight)),
      child: Row(children: [
        Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
                color: AppColors.grey100,
                borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.shopping_bag_outlined,
                color: AppColors.muted)),
        const SizedBox(width: 12),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(product['name'] as String,
              style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: inStock ? AppColors.textPrimary : AppColors.muted)),
          const SizedBox(height: 2),
          Text('${product['category']} • ${product['price']} EGP',
              style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Switch(
              value: inStock,
              onChanged: (v) {},
              activeThumbColor: AppColors.storeColor,
              activeTrackColor: AppColors.storeColor.withOpacity(0.3)),
          Text(inStock ? '$stock in stock' : 'Out of stock',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: inStock ? AppColors.success : AppColors.error)),
        ]),
      ]),
    );
  }
}
