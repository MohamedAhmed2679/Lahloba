import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  static const List<Color> _mealBannerA = [
    Color(0xFF115E59),
    Color(0xFF14B8A6)
  ];
  static const List<Color> _mealBannerB = [
    Color(0xFFF59E0B),
    Color(0xFFFB7185)
  ];
  static const List<Color> _chefBannerA = [
    Color(0xFF0F766E),
    Color(0xFF2DD4BF)
  ];
  static const List<Color> _chefBannerB = [
    Color(0xFFB45309),
    Color(0xFFF59E0B)
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _buildHeroHeader(context),
          _buildCategoriesBar(),
          const SliverToBoxAdapter(child: SizedBox(height: 16)),
          _buildSectionTitle('Featured Meals', 'See all'),
          _buildFeaturedCarousel(),
          _buildSectionTitle('Order Again', 'History'),
          _buildReorderSection(),
          _buildSectionTitle('Top Chefs Near You', 'Explore'),
          _buildTopChefs(),
          const SliverPadding(padding: EdgeInsets.only(bottom: 30)),
        ],
      ),
    );
  }

  Widget _buildHeroHeader(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 180,
      pinned: true,
      elevation: 0,
      backgroundColor: Colors.transparent,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.primary, AppColors.primaryLight],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Delivering to',
                              style: TextStyle(
                                  color: Colors.white.withOpacity(0.8),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500)),
                          const Row(
                            children: [
                              Text('Maadi, Cairo',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold)),
                              Icon(Icons.keyboard_arrow_down,
                                  color: Colors.white, size: 20),
                            ],
                          ),
                        ],
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            shape: BoxShape.circle),
                        child: const Icon(Icons.notifications_outlined,
                            color: Colors.white, size: 24),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Container(
                    height: 50,
                    decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(25),
                        boxShadow: [
                          BoxShadow(
                              color: Colors.black.withOpacity(0.1),
                              blurRadius: 10,
                              offset: const Offset(0, 4))
                        ]),
                    child: Row(
                      children: [
                        const SizedBox(width: 16),
                        const Icon(Icons.search, color: AppColors.muted),
                        const SizedBox(width: 12),
                        Text('What are you craving?',
                            style: TextStyle(
                                color: AppColors.muted.withOpacity(0.7),
                                fontSize: 15)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCategoriesBar() {
    final categories = [
      {'icon': '🥘', 'name': 'Cooked'},
      {'icon': '🔪', 'name': 'Ready to Cook'},
      {'icon': '🌿', 'name': 'Healthy'},
      {'icon': '🍰', 'name': 'Desserts'},
      {'icon': '🚀', 'name': 'Fast Delivery'},
    ];
    return SliverToBoxAdapter(
      child: Container(
        height: 100,
        padding: const EdgeInsets.only(top: 16),
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: categories.length,
          itemBuilder: (context, i) => Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Column(
              children: [
                Container(
                  width: 55,
                  height: 55,
                  decoration: BoxDecoration(
                      color: AppColors.grey100,
                      borderRadius: BorderRadius.circular(18)),
                  child: Center(
                      child: Text(categories[i]['icon']!,
                          style: const TextStyle(fontSize: 24))),
                ),
                const SizedBox(height: 6),
                Text(categories[i]['name']!,
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary)),
              ],
            )
                .animate()
                .fadeIn(delay: Duration(milliseconds: 50 * i))
                .slideY(begin: 0.1),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, String action) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title,
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary)),
            Text(action,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary)),
          ],
        ),
      ),
    );
  }

  Widget _buildFeaturedCarousel() {
    final meals = [
      {
        'name': 'Authentic Koshary',
        'chef': 'Chef Amira',
        'rating': 4.9,
        'price': 75,
        'time': '30-45 min',
        'icon': Icons.rice_bowl_outlined,
        'colors': _mealBannerA,
        'tag': 'Best Seller'
      },
      {
        'name': 'Stuffed Vine Leaves',
        'chef': 'Chef Hassan',
        'rating': 4.8,
        'price': 120,
        'time': '45-60 min',
        'icon': Icons.local_dining_outlined,
        'colors': _mealBannerB,
        'tag': 'Chef Special'
      },
    ];

    return SliverToBoxAdapter(
      child: SizedBox(
        height: 250,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: meals.length,
          itemBuilder: (context, i) {
            final meal = meals[i];
            return Container(
              width: 280,
              margin: const EdgeInsets.only(right: 16),
              decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 4))
                  ]),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 140,
                    decoration: BoxDecoration(
                      borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(20),
                          topRight: Radius.circular(20)),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: (meal['colors'] as List<Color>),
                      ),
                    ),
                    child: Stack(
                      children: [
                        Positioned(
                          left: 16,
                          bottom: 16,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  meal['tag'] as String,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Icon(meal['icon'] as IconData,
                                  size: 34, color: Colors.white),
                            ],
                          ),
                        ),
                        Positioned(
                          top: 10,
                          right: 10,
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                                color: Colors.white, shape: BoxShape.circle),
                            child: const Icon(Icons.favorite_border,
                                size: 20, color: AppColors.primary),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                                child: Text(meal['name'] as String,
                                    style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis)),
                            Text('${meal['price']} EGP',
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text('By ${meal['chef']}',
                            style: const TextStyle(
                                fontSize: 13, color: AppColors.muted)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.star,
                                color: AppColors.secondary, size: 16),
                            const SizedBox(width: 4),
                            Text('${meal['rating']}',
                                style: const TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 12),
                            const Icon(Icons.access_time_filled,
                                color: AppColors.muted, size: 16),
                            const SizedBox(width: 4),
                            Text('${meal['time']}',
                                style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textSecondary)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(delay: Duration(milliseconds: 100 * i)).scaleXY(
                begin: 0.9, duration: const Duration(milliseconds: 300));
          },
        ),
      ),
    );
  }

  Widget _buildReorderSection() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
              color: AppColors.primary50,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary100)),
          child: Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: const LinearGradient(
                      colors: [AppColors.primary, AppColors.primaryLight]),
                ),
                child: const Icon(Icons.restaurant_menu,
                    color: Colors.white, size: 28),
              ),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Macaroni Béchamel',
                        style: TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 16)),
                    Text('Chef Salma',
                        style: TextStyle(color: AppColors.muted, fontSize: 13)),
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    minimumSize: const Size(0, 36)),
                child: const Text('Reorder',
                    style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopChefs() {
    final chefs = [
      {'name': 'Chef Salma', 'rating': 4.9, 'accent': _chefBannerA},
      {'name': 'Chef Omar', 'rating': 4.8, 'accent': _chefBannerB},
      {'name': 'Chef Nour', 'rating': 4.7, 'accent': _mealBannerA},
      {'name': 'Chef Ali', 'rating': 4.6, 'accent': _mealBannerB},
    ];

    return SliverToBoxAdapter(
      child: SizedBox(
        height: 120,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: chefs.length,
          itemBuilder: (context, i) => Padding(
            padding: const EdgeInsets.only(right: 20),
            child: Column(
              children: [
                Stack(
                  alignment: Alignment.bottomCenter,
                  children: [
                    Container(
                      width: 70,
                      height: 70,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: chefs[i]['accent'] as List<Color>,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          _initials(chefs[i]['name'] as String),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: -5,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            boxShadow: [
                              BoxShadow(
                                  color: Colors.black.withOpacity(0.1),
                                  blurRadius: 4)
                            ]),
                        child: Row(
                          children: [
                            const Icon(Icons.star,
                                color: AppColors.secondary, size: 12),
                            Text(' ${chefs[i]['rating']}',
                                style: const TextStyle(
                                    fontSize: 10, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(chefs[i]['name'] as String,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts =
        name.split(' ').where((part) => part.isNotEmpty).take(2).toList();
    return parts.map((part) => part[0]).join().toUpperCase();
  }
}
