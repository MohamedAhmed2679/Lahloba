import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../config/providers.dart';

class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const Spacer(flex: 2),
              // Logo
              Container(
                width: 120, height: 120,
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(30)),
                child: const Center(child: Text('L', style: TextStyle(fontSize: 56, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'Cairo'))),
              ),
              const SizedBox(height: 32),
              Text('Lahloba', style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold, color: AppColors.primary)),
              const SizedBox(height: 8),
              Text(
                locale.languageCode == 'ar' ? 'أكل بيتي، يوصلك طازج' : 'Home-made meals, delivered fresh',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppColors.muted),
                textAlign: TextAlign.center,
              ),
              const Spacer(flex: 3),
              ElevatedButton(onPressed: () => context.go('/login'), child: Text(locale.languageCode == 'ar' ? 'تسجيل الدخول' : 'Log In')),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: () => context.go('/login'), child: Text(locale.languageCode == 'ar' ? 'إنشاء حساب' : 'Create Account')),
              const SizedBox(height: 16),
              TextButton.icon(
                onPressed: () {
                  final newLocale = locale.languageCode == 'en' ? const Locale('ar') : const Locale('en');
                  ref.read(localeProvider.notifier).state = newLocale;
                },
                icon: const Icon(Icons.language, size: 18),
                label: Text(locale.languageCode == 'en' ? 'العربية' : 'English'),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
