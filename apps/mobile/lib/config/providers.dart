import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// ── Auth State ─────────────────────────────────────────────────
enum UserRole { customer, chef, delivery, store, admin, none }

UserRole roleFromString(String? role) {
  switch (role?.toUpperCase()) {
    case 'CHEF': return UserRole.chef;
    case 'DELIVERY': return UserRole.delivery;
    case 'STORE': return UserRole.store;
    case 'ADMIN': return UserRole.admin;
    case 'CUSTOMER': return UserRole.customer;
    default: return UserRole.none;
  }
}

class AuthState {
  final String? token;
  final String? refreshToken;
  final Map<String, dynamic>? user;
  final UserRole role;
  final bool isLoading;

  const AuthState({
    this.token,
    this.refreshToken,
    this.user,
    this.role = UserRole.none,
    this.isLoading = false,
  });

  bool get isAuthenticated => token != null && role != UserRole.none;

  AuthState copyWith({
    String? token,
    String? refreshToken,
    Map<String, dynamic>? user,
    UserRole? role,
    bool? isLoading,
  }) => AuthState(
    token: token ?? this.token,
    refreshToken: refreshToken ?? this.refreshToken,
    user: user ?? this.user,
    role: role ?? this.role,
    isLoading: isLoading ?? this.isLoading,
  );
}

// ── Secure Storage ─────────────────────────────────────────────
const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
);

// ── Auth Notifier ──────────────────────────────────────────────
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState(isLoading: true)) {
    _hydrate();
  }

  Future<void> _hydrate() async {
    try {
      final token = await _storage.read(key: 'access_token');
      final roleStr = await _storage.read(key: 'user_role');
      final userId = await _storage.read(key: 'user_id');
      final userName = await _storage.read(key: 'user_name');
      if (token != null && roleStr != null) {
        state = AuthState(
          token: token,
          role: roleFromString(roleStr),
          user: {'userId': userId, 'name': userName, 'role': roleStr},
          isLoading: false,
        );
      } else {
        state = const AuthState(isLoading: false);
      }
    } catch (_) {
      state = const AuthState(isLoading: false);
    }
  }

  Future<void> login({
    required String token,
    required String refreshToken,
    required Map<String, dynamic> user,
  }) async {
    final role = roleFromString(user['role'] as String?);
    await _storage.write(key: 'access_token', value: token);
    await _storage.write(key: 'refresh_token', value: refreshToken);
    await _storage.write(key: 'user_role', value: user['role'] as String? ?? '');
    await _storage.write(key: 'user_id', value: user['userId'] as String? ?? '');
    await _storage.write(key: 'user_name', value: user['name'] as String? ?? '');
    state = AuthState(token: token, refreshToken: refreshToken, user: user, role: role);
  }

  Future<void> logout() async {
    await _storage.deleteAll();
    state = const AuthState();
  }

  void setLoading(bool loading) => state = state.copyWith(isLoading: loading);
}

// ── Providers ──────────────────────────────────────────────────
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier());

final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);
final localeProvider = StateProvider<Locale>((ref) => const Locale('en'));

// Convenience selectors
final isAuthenticatedProvider = Provider<bool>((ref) => ref.watch(authProvider).isAuthenticated);
final userRoleProvider = Provider<UserRole>((ref) => ref.watch(authProvider).role);
final authTokenProvider = Provider<String?>((ref) => ref.watch(authProvider).token);
final currentUserProvider = Provider<Map<String, dynamic>?>((ref) => ref.watch(authProvider).user);

// ── Legacy compat aliases (used in some screens) ───────────────
// ignore: deprecated_member_use_from_same_package
@Deprecated('Use authProvider instead')
final legacyAuthTokenProvider = authTokenProvider;
