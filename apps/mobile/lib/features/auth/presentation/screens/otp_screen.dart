import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../config/providers.dart';
import '../../../../services/api_service.dart';

class OtpScreen extends ConsumerStatefulWidget {
  final String destination;
  const OtpScreen({super.key, required this.destination});
  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _ctrls = List.generate(6, (_) => TextEditingController());
  final _nodes = List.generate(6, (_) => FocusNode());
  final _api = ApiService();
  bool _loading = false;

  @override
  void dispose() {
    for (var c in _ctrls) {
      c.dispose();
    }
    for (var f in _nodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _otp => _ctrls.map((c) => c.text).join();

  String _routeForRole(String? role) {
    switch (role?.toUpperCase()) {
      case 'CHEF':
        return '/chef';
      case 'DELIVERY':
        return '/delivery';
      case 'STORE':
        return '/store';
      case 'ADMIN':
        return '/admin';
      case 'CUSTOMER':
      default:
        return '/home';
    }
  }

  void _showMessage(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: error ? AppColors.error : AppColors.primary,
        ),
      );
  }

  Future<void> _verify() async {
    if (_otp.length != 6) {
      _showMessage('Enter the full 6-digit code.', error: true);
      return;
    }

    setState(() => _loading = true);
    try {
      final response = await _api.verifyOtp(widget.destination, _otp);
      final data =
          response.data as Map<String, dynamic>? ?? const <String, dynamic>{};
      final userData = (data['user'] as Map?)?.cast<String, dynamic>() ??
          const <String, dynamic>{};
      final normalizedUser = <String, dynamic>{
        'userId':
            userData['user_id']?.toString() ?? userData['userId']?.toString(),
        'name': userData['name']?.toString() ?? 'Lahloba User',
        'phone': userData['phone']?.toString(),
        'locale': userData['locale']?.toString() ?? 'en',
        'role': userData['role']?.toString() ?? 'CUSTOMER',
      };

      await ref.read(authProvider.notifier).login(
            token: data['access_token']?.toString() ?? '',
            refreshToken: data['refresh_token']?.toString() ?? '',
            user: normalizedUser,
          );

      if (!mounted) return;
      context.go(_routeForRole(normalizedUser['role']?.toString()));
    } on DioException catch (error) {
      final message = error.response?.data is Map<String, dynamic>
          ? (error.response?.data['message']?.toString() ??
              'Verification failed.')
          : 'Verification failed.';
      _showMessage(message, error: true);
    } catch (_) {
      _showMessage('Verification failed.', error: true);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const BackButton()),
      body: SafeArea(
          child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 24),
                    Text('Verification Code',
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text('Code sent to ${widget.destination}',
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: AppColors.muted)),
                    const SizedBox(height: 40),
                    Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: List.generate(
                            6,
                            (i) => SizedBox(
                                width: 48,
                                height: 56,
                                child: TextField(
                                  controller: _ctrls[i],
                                  focusNode: _nodes[i],
                                  textAlign: TextAlign.center,
                                  keyboardType: TextInputType.number,
                                  maxLength: 1,
                                  style: const TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold),
                                  decoration:
                                      const InputDecoration(counterText: ''),
                                  onChanged: (v) {
                                    if (v.isNotEmpty && i < 5) {
                                      _nodes[i + 1].requestFocus();
                                    }
                                    if (v.isEmpty && i > 0) {
                                      _nodes[i - 1].requestFocus();
                                    }
                                    if (_otp.length == 6) _verify();
                                  },
                                )))),
                    const SizedBox(height: 32),
                    Center(
                        child: TextButton(
                            onPressed:
                                _loading ? null : () => context.go('/login'),
                            child: const Text('Resend Code'))),
                    const Spacer(),
                    ElevatedButton(
                        onPressed: _loading ? null : _verify,
                        child: _loading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : const Text('Verify')),
                    const SizedBox(height: 32),
                  ]))),
    );
  }
}
