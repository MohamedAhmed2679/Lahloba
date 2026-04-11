import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../../../core/theme/app_colors.dart';
import '../../data/paymob_service.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final PaymobService _paymobService = PaymobService();
  bool _isLoading = false;
  String? _paymentUrl;
  late final WebViewController _webViewController;

  @override
  void initState() {
    super.initState();
    _webViewController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            if (request.url.contains('success=true')) {
              _handlePaymentSuccess();
              return NavigationDecision.prevent;
            } else if (request.url.contains('success=false')) {
              _handlePaymentFailure();
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      );
  }

  Future<void> _startPayment() async {
    setState(() => _isLoading = true);
    try {
      // In a real app, these values come from the cart / user profile
      final url = await _paymobService.initiatePayment(
        orderId: 'ORDER_${DateTime.now().millisecondsSinceEpoch}',
        amount: 250.00,
        billingData: {
          'apartment': '803',
          'email': 'customer@example.com',
          'floor': '42',
          'first_name': 'Ahmed',
          'street': 'El Gezira',
          'building': '8023',
          'phone_number': '+201011122233',
          'shipping_method': 'PKG',
          'postal_code': '11728',
          'city': 'Cairo',
          'country': 'EG',
          'last_name': 'Mustafa',
          'state': 'Cairo'
        },
      );

      if (url == 'mock_paymob_url') {
        // Mock successful payment if API keys aren't set
        await Future.delayed(const Duration(seconds: 1));
        _handlePaymentSuccess();
        return;
      }

      setState(() {
        _paymentUrl = url;
        _isLoading = false;
      });
      _webViewController.loadRequest(Uri.parse(url));
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Payment init failed: $e')));
    }
  }

  void _handlePaymentSuccess() {
    context.go('/tracking/SIMULATED_ORDER');
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Payment Successful!'),
      backgroundColor: AppColors.success,
    ));
  }

  void _handlePaymentFailure() {
    setState(() => _paymentUrl = null);
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Payment Failed. Please try again.'),
      backgroundColor: AppColors.error,
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (_paymentUrl != null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Complete Payment'),
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => setState(() => _paymentUrl = null),
          ),
        ),
        body: WebViewWidget(controller: _webViewController),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Order Summary',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 20),
                  const _SummaryRow(label: 'Subtotal', value: '230.00 EGP'),
                  const SizedBox(height: 10),
                  const _SummaryRow(label: 'Delivery Fee', value: '20.00 EGP'),
                  const Divider(height: 30),
                  const _SummaryRow(
                      label: 'Total', value: '250.00 EGP', isTotal: true),
                  const Spacer(),
                  ElevatedButton(
                    onPressed: _startPayment,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 56),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('Pay with Paymob',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label, value;
  final bool isTotal;
  const _SummaryRow(
      {required this.label, required this.value, this.isTotal = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: TextStyle(
              fontSize: isTotal ? 18 : 15,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.w500,
              color: isTotal ? AppColors.textPrimary : AppColors.muted,
            )),
        Text(value,
            style: TextStyle(
              fontSize: isTotal ? 18 : 15,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.w600,
            )),
      ],
    );
  }
}
