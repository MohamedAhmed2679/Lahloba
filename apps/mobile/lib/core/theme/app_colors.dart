import 'package:flutter/material.dart';

/// Lahloba Premium Color Palette
/// Inspired by Talabat (bold orange), Uber Eats (clean whites), Breadfast (warm neutrals)
/// Enhanced with premium depth and energy.
class AppColors {
  AppColors._();

  // ── Primary Brand ──────────────────────────────────────────────
  /// Energetic teal — Lahloba's signature (preserved for brand identity)
  static const primary = Color(0xFF0D9488);      // teal-600
  static const primaryDark = Color(0xFF0F766E);   // teal-700
  static const primaryLight = Color(0xFF14B8A6);  // teal-500

  // ── Accent / Action ────────────────────────────────────────────
  /// Bold orange — Talabat-inspired energy for CTAs
  static const accent = Color(0xFFFF6B35);
  static const accentDark = Color(0xFFE55A24);
  static const accentLight = Color(0xFFFF8C61);

  // ── Secondary / Highlight ──────────────────────────────────────
  /// Warm amber — for prices, ratings, badges
  static const secondary = Color(0xFFF59E0B);    // amber-500
  static const secondaryDark = Color(0xFFD97706); // amber-600

  // ── Semantic ───────────────────────────────────────────────────
  static const error = Color(0xFFE11D48);        // rose-600
  static const success = Color(0xFF16A34A);       // green-600
  static const warning = Color(0xFFF59E0B);       // amber-500
  static const info = Color(0xFF0EA5E9);          // sky-500

  // ── Tints (Light surfaces) ─────────────────────────────────────
  static const primary50 = Color(0xFFF0FDFA);
  static const primary100 = Color(0xFFCCFBF1);
  static const primary200 = Color(0xFF99F6E4);
  static const accent50 = Color(0xFFFFF4F0);
  static const accent100 = Color(0xFFFFE4D9);
  static const amber50 = Color(0xFFFFFBEB);
  static const amber100 = Color(0xFFFEF3C7);
  static const coral50 = Color(0xFFFFF1F2);
  static const lime50 = Color(0xFFF7FEE7);
  static const sky50 = Color(0xFFF0F9FF);

  // ── Neutral Scale ──────────────────────────────────────────────
  static const grey50 = Color(0xFFF8FAFC);
  static const grey100 = Color(0xFFF1F5F9);
  static const grey200 = Color(0xFFE2E8F0);
  static const grey300 = Color(0xFFCBD5E1);
  static const grey400 = Color(0xFF94A3B8);
  static const grey500 = Color(0xFF64748B);
  static const grey600 = Color(0xFF475569);
  static const grey700 = Color(0xFF334155);
  static const grey800 = Color(0xFF1E293B);
  static const grey900 = Color(0xFF0F172A);

  // ── Text ───────────────────────────────────────────────────────
  static const textPrimary = Color(0xFF0F172A);   // slate-900
  static const textSecondary = Color(0xFF475569);  // slate-600
  static const textMuted = Color(0xFF94A3B8);      // slate-400 (use sparingly)
  static const muted = Color(0xFF64748B);          // slate-500
  static const textLight = Color(0xFF0F172A);
  static const textDark = Color(0xFFF1F5F9);

  // ── Surfaces ───────────────────────────────────────────────────
  static const surfaceLight = Color(0xFFFFFFFF);
  static const surfaceDark = Color(0xFF0F172A);
  static const cardLight = Color(0xFFFFFFFF);
  static const cardDark = Color(0xFF1E293B);
  static const backgroundLight = Color(0xFFF8FAFC);   // Almost-white, not pure white
  static const backgroundDark = Color(0xFF0B1120);    // Very deep navy (richer than slate-900)

  // ── Borders ────────────────────────────────────────────────────
  static const borderLight = Color(0xFFE2E8F0);
  static const borderDark = Color(0xFF1E293B);

  // ── Gradients (convenience) ────────────────────────────────────
  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0D9488), Color(0xFF0F766E)],
  );

  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0D9488), Color(0xFF0284C7)],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFF6B35), Color(0xFFFF4500)],
  );

  static const LinearGradient darkCardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
  );

  // ── Role-specific accent colors ────────────────────────────────
  static const chefColor = Color(0xFF6D28D9);    // violet-700
  static const driverColor = Color(0xFF0EA5E9);  // sky-500
  static const storeColor = Color(0xFFF59E0B);   // amber-500
  static const adminColor = Color(0xFFE11D48);   // rose-600
}
