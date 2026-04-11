import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../core/theme/app_colors.dart';

class ChefMealsScreen extends StatefulWidget {
  const ChefMealsScreen({super.key});
  @override
  State<ChefMealsScreen> createState() => _ChefMealsScreenState();
}

class _ChefMealsScreenState extends State<ChefMealsScreen> {
  final _meals = [
    {
      'id': 'M001',
      'name': 'Egyptian Chicken Rice',
      'price': 150,
      'orders': 42,
      'rating': 4.8,
      'active': true,
      'type': 'COOKED'
    },
    {
      'id': 'M002',
      'name': 'Pasta Alfredo',
      'price': 120,
      'orders': 28,
      'rating': 4.5,
      'active': true,
      'type': 'COOKED'
    },
    {
      'id': 'M003',
      'name': 'Kofta Kit',
      'price': 100,
      'orders': 19,
      'rating': 4.6,
      'active': false,
      'type': 'RTC'
    },
    {
      'id': 'M004',
      'name': 'Maqlouba',
      'price': 180,
      'orders': 15,
      'rating': 4.9,
      'active': true,
      'type': 'COOKED'
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Meals'),
        actions: [
          IconButton(
              icon: const Icon(Icons.add_circle_outline),
              onPressed: () => _showAddMeal(context))
        ],
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _meals.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _MealCard(
          meal: _meals[i],
          onToggle: (v) =>
              setState(() => _meals[i] = {..._meals[i], 'active': v}),
        )
            .animate()
            .fadeIn(delay: Duration(milliseconds: i * 60))
            .slideY(begin: 0.05),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddMeal(context),
        backgroundColor: const Color(0xFF6D28D9),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Add Meal',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
    );
  }

  void _showAddMeal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 20),
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Add New Meal',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
              const SizedBox(height: 16),
              const TextField(
                  decoration: InputDecoration(
                      hintText: 'Meal name (English)',
                      prefixIcon: Icon(Icons.restaurant_menu))),
              const SizedBox(height: 10),
              const TextField(
                  decoration: InputDecoration(
                      hintText: 'Price (EGP)',
                      prefixIcon: Icon(Icons.attach_money))),
              const SizedBox(height: 10),
              const TextField(
                  decoration: InputDecoration(
                      hintText: 'Prep time (minutes)',
                      prefixIcon: Icon(Icons.timer))),
              const SizedBox(height: 20),
              ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6D28D9)),
                  child: const Text('Create Meal')),
              const SizedBox(height: 20),
            ]),
      ),
    );
  }
}

class _MealCard extends StatelessWidget {
  final Map<String, dynamic> meal;
  final ValueChanged<bool> onToggle;
  const _MealCard({required this.meal, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final isActive = meal['active'] as bool;
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
        border: isActive ? null : Border.all(color: AppColors.borderLight),
      ),
      child: Row(children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
              color: AppColors.primary50,
              borderRadius: BorderRadius.circular(14)),
          child: Stack(children: [
            const Center(
                child:
                    Icon(Icons.restaurant, color: AppColors.primary, size: 28)),
            if (!isActive)
              Container(
                  decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.6),
                      borderRadius: BorderRadius.circular(14))),
          ]),
        ),
        const SizedBox(width: 14),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
                child: Text(meal['name'] as String,
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: isActive ? null : AppColors.muted))),
            Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                    color: meal['type'] == 'COOKED'
                        ? AppColors.primary100
                        : AppColors.amber100,
                    borderRadius: BorderRadius.circular(6)),
                child: Text(meal['type'] as String,
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: meal['type'] == 'COOKED'
                            ? AppColors.primary
                            : AppColors.secondaryDark))),
          ]),
          const SizedBox(height: 4),
          Row(children: [
            Text('${meal['price']} EGP',
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.secondary,
                    fontSize: 14)),
            const Text(' · ', style: TextStyle(color: AppColors.muted)),
            const Icon(Icons.star, size: 13, color: AppColors.secondary),
            Text(' ${meal['rating']}',
                style:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            const Text(' · ', style: TextStyle(color: AppColors.muted)),
            Text('${meal['orders']} orders',
                style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          ]),
        ])),
        Switch(
            value: isActive,
            onChanged: onToggle,
            activeThumbColor: const Color(0xFF6D28D9)),
      ]),
    );
  }
}
