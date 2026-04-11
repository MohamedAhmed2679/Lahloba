import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_colors.dart';

/// Lahloba Premium Theme
/// Inspired by Talabat, Uber Eats & Breadfast — with enhanced depth, motion and typography.
class AppTheme {
  AppTheme._();

  static const _fontEn = 'PlusJakartaSans';
  static const _fontAr = 'Cairo'; // Used in locale-aware widgets

  // ── Typography ─────────────────────────────────────────────────
  static TextTheme _textTheme(Color base) => TextTheme(
        displayLarge: TextStyle(
            fontFamily: _fontEn,
            fontSize: 57,
            fontWeight: FontWeight.w700,
            color: base,
            letterSpacing: -1.5),
        displayMedium: TextStyle(
            fontFamily: _fontEn,
            fontSize: 45,
            fontWeight: FontWeight.w700,
            color: base,
            letterSpacing: -0.5),
        displaySmall: TextStyle(
            fontFamily: _fontEn,
            fontSize: 36,
            fontWeight: FontWeight.w600,
            color: base),
        headlineLarge: TextStyle(
            fontFamily: _fontEn,
            fontSize: 32,
            fontWeight: FontWeight.w700,
            color: base,
            letterSpacing: -0.5),
        headlineMedium: TextStyle(
            fontFamily: _fontEn,
            fontSize: 28,
            fontWeight: FontWeight.w700,
            color: base),
        headlineSmall: TextStyle(
            fontFamily: _fontEn,
            fontSize: 24,
            fontWeight: FontWeight.w600,
            color: base),
        titleLarge: TextStyle(
            fontFamily: _fontEn,
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: base),
        titleMedium: TextStyle(
            fontFamily: _fontEn,
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: base,
            letterSpacing: 0.1),
        titleSmall: TextStyle(
            fontFamily: _fontEn,
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: base,
            letterSpacing: 0.1),
        bodyLarge: TextStyle(
            fontFamily: _fontEn,
            fontSize: 16,
            fontWeight: FontWeight.w400,
            color: base,
            height: 1.6),
        bodyMedium: TextStyle(
            fontFamily: _fontEn,
            fontSize: 14,
            fontWeight: FontWeight.w400,
            color: base,
            height: 1.5),
        bodySmall: TextStyle(
            fontFamily: _fontEn,
            fontSize: 12,
            fontWeight: FontWeight.w400,
            color: base,
            height: 1.4),
        labelLarge: TextStyle(
            fontFamily: _fontEn,
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: base,
            letterSpacing: 0.1),
        labelMedium: TextStyle(
            fontFamily: _fontEn,
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: base),
        labelSmall: TextStyle(
            fontFamily: _fontEn,
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: base,
            letterSpacing: 0.5),
      );

  // ── Shadows ────────────────────────────────────────────────────
  static List<BoxShadow> get cardShadow => [
        BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 16,
            offset: const Offset(0, 4)),
        BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 4,
            offset: const Offset(0, 1)),
      ];
  static List<BoxShadow> get elevatedShadow => [
        BoxShadow(
            color: AppColors.primary.withOpacity(0.25),
            blurRadius: 20,
            offset: const Offset(0, 8)),
        BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 8,
            offset: const Offset(0, 2)),
      ];

  // ── Light Theme ────────────────────────────────────────────────
  static ThemeData light() => ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        fontFamily: _fontEn,

        colorScheme: const ColorScheme.light(
          primary: AppColors.primary,
          onPrimary: Colors.white,
          primaryContainer: AppColors.primary100,
          onPrimaryContainer: AppColors.primaryDark,
          secondary: AppColors.secondary,
          onSecondary: Colors.white,
          secondaryContainer: AppColors.amber100,
          onSecondaryContainer: AppColors.secondaryDark,
          tertiary: AppColors.accent,
          onTertiary: Colors.white,
          tertiaryContainer: AppColors.accent100,
          onTertiaryContainer: AppColors.accentDark,
          error: AppColors.error,
          onError: Colors.white,
          surface: AppColors.surfaceLight,
          onSurface: AppColors.textPrimary,
          surfaceContainerHighest: AppColors.grey100,
          outline: AppColors.borderLight,
          outlineVariant: AppColors.grey200,
          shadow: Color(0x1A000000),
          scrim: Color(0x99000000),
        ),

        scaffoldBackgroundColor: AppColors.backgroundLight,
        textTheme: _textTheme(AppColors.textPrimary),

        // AppBar
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: AppColors.textPrimary,
          elevation: 0,
          scrolledUnderElevation: 1,
          shadowColor: Color(0x10000000),
          centerTitle: true,
          systemOverlayStyle: SystemUiOverlayStyle(
            statusBarBrightness: Brightness.light,
            statusBarIconBrightness: Brightness.dark,
            statusBarColor: Colors.transparent,
          ),
          titleTextStyle: TextStyle(
            fontFamily: _fontEn,
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
            letterSpacing: -0.3,
          ),
          iconTheme: IconThemeData(color: AppColors.textPrimary, size: 24),
        ),

        // Elevated Button — Primary action (teal brand)
        elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 54),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(
              fontFamily: _fontEn,
              fontSize: 16,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2),
          elevation: 0,
          shadowColor: Colors.transparent,
        )),

        // Filled Button — Secondary action (accent orange)
        filledButtonTheme: FilledButtonThemeData(
            style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 54),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(
              fontFamily: _fontEn, fontSize: 16, fontWeight: FontWeight.w700),
        )),

        // Outlined Button
        outlinedButtonTheme: OutlinedButtonThemeData(
            style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          minimumSize: const Size(double.infinity, 54),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          side: const BorderSide(color: AppColors.primary, width: 1.5),
          textStyle: const TextStyle(
              fontFamily: _fontEn, fontSize: 16, fontWeight: FontWeight.w600),
        )),

        // Text Button
        textButtonTheme: TextButtonThemeData(
            style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: const TextStyle(
              fontFamily: _fontEn, fontSize: 14, fontWeight: FontWeight.w600),
        )),

        // Card
        cardTheme: CardTheme(
          elevation: 0,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          color: Colors.white,
          clipBehavior: Clip.antiAlias,
          margin: EdgeInsets.zero,
        ),

        // Input Fields
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.grey100,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.primary, width: 2),
          ),
          errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.error, width: 1.5)),
          hintStyle: const TextStyle(
              fontFamily: _fontEn, color: AppColors.muted, fontSize: 14),
          labelStyle: const TextStyle(
              fontFamily: _fontEn, color: AppColors.muted, fontSize: 14),
        ),

        // Bottom Navigation Bar
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Colors.white,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.muted,
          type: BottomNavigationBarType.fixed,
          showUnselectedLabels: true,
          elevation: 0,
          selectedLabelStyle: TextStyle(
              fontFamily: _fontEn, fontSize: 11, fontWeight: FontWeight.w600),
          unselectedLabelStyle: TextStyle(fontFamily: _fontEn, fontSize: 11),
        ),

        // Navigation Bar (Material 3)
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: Colors.white,
          indicatorColor: AppColors.primary100,
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected))
              return const IconThemeData(color: AppColors.primary);
            return const IconThemeData(color: AppColors.muted);
          }),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected))
              return const TextStyle(
                  fontFamily: _fontEn,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary);
            return const TextStyle(
                fontFamily: _fontEn, fontSize: 11, color: AppColors.muted);
          }),
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),

        // Chip
        chipTheme: ChipThemeData(
          backgroundColor: AppColors.grey100,
          selectedColor: AppColors.primary,
          labelStyle: const TextStyle(
              fontFamily: _fontEn, fontSize: 13, fontWeight: FontWeight.w500),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          side: BorderSide.none,
          showCheckmark: false,
        ),

        // Divider
        dividerTheme: const DividerThemeData(
            color: AppColors.borderLight, thickness: 1, space: 0),

        // Switch
        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith((s) =>
              s.contains(WidgetState.selected)
                  ? AppColors.primary
                  : AppColors.grey400),
          trackColor: WidgetStateProperty.resolveWith((s) =>
              s.contains(WidgetState.selected)
                  ? AppColors.primary100
                  : AppColors.grey200),
        ),

        // Page Transitions
        pageTransitionsTheme: const PageTransitionsTheme(builders: {
          TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
        }),
      );

  // ── Dark Theme ─────────────────────────────────────────────────
  static ThemeData dark() => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        fontFamily: _fontEn,
        colorScheme: const ColorScheme.dark(
          primary: AppColors.primaryLight,
          onPrimary: Colors.white,
          primaryContainer: Color(0xFF134E4A), // teal-900
          onPrimaryContainer: AppColors.primary200,
          secondary: AppColors.secondary,
          onSecondary: AppColors.grey900,
          secondaryContainer: Color(0xFF78350F), // amber-900
          onSecondaryContainer: AppColors.amber100,
          tertiary: AppColors.accentLight,
          onTertiary: Colors.white,
          tertiaryContainer: Color(0xFF7C2D12), // orange-900
          onTertiaryContainer: AppColors.accent100,
          error: Color(0xFFFB7185),
          onError: AppColors.grey900,
          surface: Color(0xFF0B1120),
          onSurface: AppColors.textDark,
          surfaceContainerHighest: AppColors.grey800,
          outline: AppColors.grey700,
          outlineVariant: AppColors.grey800,
        ),
        scaffoldBackgroundColor: AppColors.backgroundDark,
        textTheme: _textTheme(AppColors.textDark),
        appBarTheme: const AppBarTheme(
          backgroundColor: AppColors.backgroundDark,
          foregroundColor: AppColors.textDark,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: true,
          systemOverlayStyle: SystemUiOverlayStyle(
            statusBarBrightness: Brightness.dark,
            statusBarIconBrightness: Brightness.light,
            statusBarColor: Colors.transparent,
          ),
          titleTextStyle: TextStyle(
              fontFamily: _fontEn,
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
              letterSpacing: -0.3),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 54),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(
              fontFamily: _fontEn, fontSize: 16, fontWeight: FontWeight.w700),
          elevation: 0,
        )),
        filledButtonTheme: FilledButtonThemeData(
            style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 54),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(
              fontFamily: _fontEn, fontSize: 16, fontWeight: FontWeight.w700),
        )),
        outlinedButtonTheme: OutlinedButtonThemeData(
            style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primaryLight,
          minimumSize: const Size(double.infinity, 54),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          side: const BorderSide(color: AppColors.primaryLight, width: 1.5),
          textStyle: const TextStyle(
              fontFamily: _fontEn, fontSize: 16, fontWeight: FontWeight.w600),
        )),
        cardTheme: CardTheme(
          elevation: 0,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          color: AppColors.grey800,
          clipBehavior: Clip.antiAlias,
          margin: EdgeInsets.zero,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.grey800,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide:
                  const BorderSide(color: AppColors.primaryLight, width: 2)),
          hintStyle: TextStyle(
              fontFamily: _fontEn,
              color: AppColors.textDark.withOpacity(0.4),
              fontSize: 14),
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: AppColors.backgroundDark,
          selectedItemColor: AppColors.primaryLight,
          unselectedItemColor: AppColors.grey500,
          type: BottomNavigationBarType.fixed,
          showUnselectedLabels: true,
          elevation: 0,
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppColors.backgroundDark,
          indicatorColor: const Color(0xFF134E4A),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected))
              return const IconThemeData(color: AppColors.primaryLight);
            return const IconThemeData(color: AppColors.grey500);
          }),
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
        chipTheme: ChipThemeData(
          backgroundColor: AppColors.grey800,
          selectedColor: AppColors.primaryDark,
          labelStyle: const TextStyle(
              fontFamily: _fontEn,
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.textDark),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          side: BorderSide.none,
          showCheckmark: false,
        ),
        dividerTheme: const DividerThemeData(
            color: AppColors.borderDark, thickness: 1, space: 0),
        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith((s) =>
              s.contains(WidgetState.selected)
                  ? AppColors.primaryLight
                  : AppColors.grey600),
          trackColor: WidgetStateProperty.resolveWith((s) =>
              s.contains(WidgetState.selected)
                  ? const Color(0xFF134E4A)
                  : AppColors.grey700),
        ),
        pageTransitionsTheme: const PageTransitionsTheme(builders: {
          TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
        }),
      );
}
