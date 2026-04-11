import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class SearchScreen extends StatelessWidget {
  const SearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      autofocus: true,
                      decoration: InputDecoration(
                        hintText: 'Search for meals, recipes, or chefs',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: IconButton(
                            icon: const Icon(Icons.mic), onPressed: () {}),
                        filled: true,
                        fillColor: AppColors.grey100,
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(vertical: 0),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.tune),
                    onPressed: () {},
                    style: IconButton.styleFrom(
                        backgroundColor: AppColors.primary50,
                        foregroundColor: AppColors.primary),
                  ),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text('Recent Searches',
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  const Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _Chip('Koshary'),
                      _Chip('Healthy Bowl'),
                      _Chip('Pasta'),
                      _Chip('Chef Salma'),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text('Popular Right Now',
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  ListTile(
                      leading: const Icon(Icons.trending_up,
                          color: AppColors.accent),
                      title: const Text('Grilled Chicken'),
                      onTap: () {}),
                  ListTile(
                      leading: const Icon(Icons.trending_up,
                          color: AppColors.accent),
                      title: const Text('Molokhia'),
                      onTap: () {}),
                  ListTile(
                      leading: const Icon(Icons.trending_up,
                          color: AppColors.accent),
                      title: const Text('Hawawshi'),
                      onTap: () {}),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  const _Chip(this.label);
  @override
  Widget build(BuildContext context) => ActionChip(
        label: Text(label),
        onPressed: () {},
        backgroundColor: AppColors.grey100,
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      );
}
