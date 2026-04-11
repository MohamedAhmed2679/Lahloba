import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../config/providers.dart';
import '../../../../services/api_service.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phone = TextEditingController();
  final _api = ApiService();
  bool _loading = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  String? get _normalizedPhone {
    final digits = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 11 && digits.startsWith('0')) return '+2$digits';
    if (digits.length == 10) return '+20$digits';
    if (digits.length == 12 && digits.startsWith('20')) return '+$digits';
    if (digits.length == 13 && digits.startsWith('020')) {
      return '+2${digits.substring(1)}';
    }
    if (_phone.text.startsWith('+20') && digits.length >= 12) return '+$digits';
    return null;
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

  Future<void> _requestOtp() async {
    final phone = _normalizedPhone;
    if (phone == null) {
      _showMessage('Enter a valid Egyptian mobile number.', error: true);
      return;
    }

    setState(() => _loading = true);
    try {
      await _api.requestOtp(phone);
      if (!mounted) return;
      _showMessage('Verification code sent.');
      context.go('/otp?destination=$phone');
    } on DioException catch (error) {
      final message = error.response?.data is Map<String, dynamic>
          ? (error.response?.data['message']?.toString() ??
              'Could not send verification code.')
          : 'Could not send verification code.';
      _showMessage(message, error: true);
    } catch (_) {
      _showMessage('Could not send verification code.', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar:
          AppBar(leading: BackButton(onPressed: () => context.go('/welcome'))),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 24),
            Text('Enter your phone number',
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text("We'll send you a verification code",
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: AppColors.muted)),
            const SizedBox(height: 32),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(11)
              ],
              onChanged: (_) {
                if (mounted) {
                  ref.read(authProvider.notifier).setLoading(false);
                }
              },
              decoration: InputDecoration(
                prefixIcon: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Text('🇪🇬', style: TextStyle(fontSize: 20)),
                    const SizedBox(width: 8),
                    Text('+20',
                        style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Theme.of(context).colorScheme.onSurface)),
                    const SizedBox(width: 8),
                    Container(
                        width: 1, height: 24, color: AppColors.borderLight),
                  ]),
                ),
                hintText: '1XX XXX XXXX',
              ),
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.2),
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: _loading ? null : _requestOtp,
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('Send Code'),
            ),
            const SizedBox(height: 32),
          ]),
        ),
      ),
    );
  }
}
