import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'providers.dart';

// ── Auth screens ──────────────────────────────────────────────
import '../features/auth/presentation/screens/welcome_screen.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/otp_screen.dart';
import '../features/onboarding/presentation/screens/onboarding_screen.dart';

// ── Customer screens ──────────────────────────────────────────
import '../features/home/presentation/screens/home_screen.dart';
import '../features/home/presentation/screens/customer_shell.dart';
import '../features/search/presentation/screens/search_screen.dart';
import '../features/favorites/presentation/screens/favorites_screen.dart';
import '../features/orders/presentation/screens/orders_screen.dart';
import '../features/chat/presentation/screens/chat_list_screen.dart';
import '../features/chat/presentation/screens/chat_room_screen.dart';
import '../features/profile/presentation/screens/profile_screen.dart';
import '../features/meal_detail/presentation/screens/meal_detail_screen.dart';
import '../features/checkout/presentation/screens/checkout_screen.dart';
import '../features/tracking/presentation/screens/tracking_screen.dart';

// ── Chef screens ──────────────────────────────────────────────
import '../features/chef/presentation/screens/chef_dashboard_screen.dart';
import '../features/chef/presentation/screens/chef_shell.dart';
import '../features/chef/presentation/screens/chef_orders_screen.dart';
import '../features/chef/presentation/screens/chef_meals_screen.dart';
import '../features/chef/presentation/screens/chef_calendar_screen.dart';
import '../features/analytics/presentation/screens/analytics_screen.dart';

// ── Delivery screens ──────────────────────────────────────────
import '../features/delivery/presentation/screens/delivery_dashboard_screen.dart';
import '../features/delivery/presentation/screens/delivery_shell.dart';
import '../features/delivery/presentation/screens/delivery_tasks_screen.dart';
import '../features/delivery/presentation/screens/delivery_batch_screen.dart';
import '../features/delivery/presentation/screens/delivery_earnings_screen.dart';

// ── Store/Supplier screens ────────────────────────────────────
import '../features/store/presentation/screens/store_dashboard_screen.dart';
import '../features/store/presentation/screens/store_shell.dart';
import '../features/store/presentation/screens/store_fulfillments_screen.dart';
import '../features/store/presentation/screens/store_products_screen.dart';
import '../features/store/presentation/screens/store_earnings_screen.dart';

// ── Admin screens ─────────────────────────────────────────────

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/welcome',
    redirect: (context, state) {
      final isAuth = authState.isAuthenticated;
      final isLoading = authState.isLoading;
      final loc = state.matchedLocation;

      // While hydrating, don't redirect
      if (isLoading) return null;

      final publicRoutes = ['/welcome', '/login', '/otp', '/onboarding'];
      final isPublic = publicRoutes.any((r) => loc.startsWith(r));

      // Not logged in → force to welcome
      if (!isAuth && !isPublic) return '/welcome';

      // Logged in but on public page → redirect to role-specific home
      if (isAuth && isPublic) return _homeForRole(authState.role);

      // Logged in but trying to access wrong role area
      if (isAuth && !_isAllowedRoute(loc, authState.role)) {
        return _homeForRole(authState.role);
      }

      return null;
    },
    routes: [
      // ── Public ───────────────────────────────────────────────
      GoRoute(path: '/welcome', builder: (_, __) => const WelcomeScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
          path: '/otp',
          builder: (_, state) => OtpScreen(
              destination: state.uri.queryParameters['destination'] ?? '')),
      GoRoute(
          path: '/onboarding', builder: (_, __) => const OnboardingScreen()),

      // ── Customer Shell ────────────────────────────────────────
      ShellRoute(
        builder: (_, __, child) => CustomerShell(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/orders', builder: (_, __) => const OrdersScreen()),
          GoRoute(path: '/chat', builder: (_, __) => const ChatListScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
          GoRoute(
              path: '/favorites', builder: (_, __) => const FavoritesScreen()),
        ],
      ),
      // Customer detail pages (no shell)
      GoRoute(
          path: '/meal/:id',
          builder: (_, s) => MealDetailScreen(mealId: s.pathParameters['id']!)),
      GoRoute(path: '/checkout', builder: (_, __) => const CheckoutScreen()),
      GoRoute(
          path: '/tracking/:orderId',
          builder: (_, s) =>
              TrackingScreen(orderId: s.pathParameters['orderId']!)),
      GoRoute(
          path: '/chat/:roomId',
          builder: (_, s) =>
              ChatRoomScreen(roomId: s.pathParameters['roomId']!)),

      // ── Chef Shell ────────────────────────────────────────────
      ShellRoute(
        builder: (_, __, child) => ChefShell(child: child),
        routes: [
          GoRoute(
              path: '/chef', builder: (_, __) => const ChefDashboardScreen()),
          GoRoute(
              path: '/chef/orders',
              builder: (_, __) => const ChefOrdersScreen()),
          GoRoute(
              path: '/chef/meals', builder: (_, __) => const ChefMealsScreen()),
          GoRoute(
              path: '/chef/availability',
              builder: (_, __) => const ChefCalendarScreen()),
          GoRoute(
            path: 'analytics',
            builder: (context, state) => const AnalyticsScreen(),
          ),
          GoRoute(
              path: '/chef/chat', builder: (_, __) => const ChatListScreen()),
        ],
      ),
      GoRoute(
          path: '/chef/chat/:roomId',
          builder: (_, s) =>
              ChatRoomScreen(roomId: s.pathParameters['roomId']!)),

      // ── Delivery Shell ────────────────────────────────────────
      ShellRoute(
        builder: (_, __, child) => DeliveryShell(child: child),
        routes: [
          GoRoute(
              path: '/delivery',
              builder: (_, __) => const DeliveryDashboardScreen()),
          GoRoute(
              path: '/delivery/tasks',
              builder: (_, __) => const DeliveryTasksScreen()),
          GoRoute(
              path: '/delivery/active',
              builder: (_, __) => const DeliveryBatchScreen()),
          GoRoute(
              path: '/delivery/earnings',
              builder: (_, __) => const DeliveryEarningsScreen()),
        ],
      ),

      // ── Store Shell ───────────────────────────────────────────
      ShellRoute(
        builder: (_, __, child) => StoreShell(child: child),
        routes: [
          GoRoute(
              path: '/store', builder: (_, __) => const StoreDashboardScreen()),
          GoRoute(
              path: '/store/fulfillments',
              builder: (_, __) => const StoreFulfillmentsScreen()),
          GoRoute(
              path: '/store/products',
              builder: (_, __) => const StoreProductsScreen()),
          GoRoute(
              path: '/store/earnings',
              builder: (_, __) => const StoreEarningsScreen()),
        ],
      ),

      // ── Admin (mobile analytics view) ─────────────────────────
      GoRoute(path: '/admin', builder: (_, __) => const AnalyticsScreen()),
    ],
  );
});

String _homeForRole(UserRole role) {
  switch (role) {
    case UserRole.chef:
      return '/chef';
    case UserRole.delivery:
      return '/delivery';
    case UserRole.store:
      return '/store';
    case UserRole.admin:
      return '/admin';
    case UserRole.customer:
    default:
      return '/home';
  }
}

bool _isAllowedRoute(String loc, UserRole role) {
  if (role == UserRole.admin) return true; // admin can access everything
  if (role == UserRole.customer &&
      (loc.startsWith('/home') ||
          loc.startsWith('/orders') ||
          loc.startsWith('/chat') ||
          loc.startsWith('/profile') ||
          loc.startsWith('/meal') ||
          loc.startsWith('/checkout') ||
          loc.startsWith('/tracking') ||
          loc.startsWith('/search') ||
          loc.startsWith('/favorites'))) return true;
  if (role == UserRole.chef && loc.startsWith('/chef')) return true;
  if (role == UserRole.delivery && loc.startsWith('/delivery')) return true;
  if (role == UserRole.store && loc.startsWith('/store')) return true;
  return false;
}
