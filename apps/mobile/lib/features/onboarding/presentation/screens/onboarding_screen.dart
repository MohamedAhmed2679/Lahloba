import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _ctrl = PageController();
  int _page = 0;
  final _steps = [
    ('What do you crave?', 'Cooked meals, ready-to-cook kits, or groceries', Icons.restaurant_menu, ['Cooked', 'Ready-to-Cook', 'Groceries']),
    ('Speed or savings?', 'Choose fastest delivery or cheapest sourcing', Icons.speed, ['Fastest', 'Cheapest']),
    ('Where to deliver?', 'Add your delivery address', Icons.location_on, <String>[]),
  ];

  @override void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: SafeArea(child: Column(children: [
      Align(alignment: AlignmentDirectional.topEnd, child: Padding(padding: const EdgeInsets.all(16), child: TextButton(onPressed: () => context.go('/home'), child: const Text('Skip')))),
      Expanded(child: PageView.builder(
        controller: _ctrl, onPageChanged: (i) => setState(() => _page = i), itemCount: _steps.length,
        itemBuilder: (_, i) {
          final (title, sub, icon, opts) = _steps[i];
          return Padding(padding: const EdgeInsets.symmetric(horizontal: 32), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(width: 96, height: 96, decoration: BoxDecoration(color: AppColors.primary50, borderRadius: BorderRadius.circular(24)), child: Icon(icon, size: 48, color: AppColors.primary)),
            const SizedBox(height: 32),
            Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
            const SizedBox(height: 12),
            Text(sub, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppColors.muted), textAlign: TextAlign.center),
            if (opts.isNotEmpty) ...[const SizedBox(height: 32), Wrap(spacing: 12, runSpacing: 12, alignment: WrapAlignment.center, children: opts.map((o) => ChoiceChip(label: Text(o), selected: false, onSelected: (_) {})).toList())],
          ]));
        },
      )),
      Padding(padding: const EdgeInsets.all(24), child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(_steps.length, (i) => AnimatedContainer(duration: const Duration(milliseconds: 200), width: _page == i ? 24 : 8, height: 8, margin: const EdgeInsets.symmetric(horizontal: 4), decoration: BoxDecoration(color: _page == i ? AppColors.primary : AppColors.muted.withOpacity(0.3), borderRadius: BorderRadius.circular(4))))),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () { if (_page < _steps.length - 1) {
            _ctrl.nextPage(duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
          } else {
            context.go('/home');
          } },
          child: Text(_page == _steps.length - 1 ? 'Get Started' : 'Next'),
        ),
      ])),
    ])));
  }
}
