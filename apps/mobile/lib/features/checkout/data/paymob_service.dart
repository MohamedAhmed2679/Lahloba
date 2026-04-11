import 'dart:convert';
import 'package:http/http.dart' as http;

class PaymobService {
  static const String _baseUrl = 'https://accept.paymob.com/api';
  // TODO: Set these keys when your account is ready
  static const String _apiKey = 'YOUR_PAYMOB_API_KEY_HERE';
  static const String _integrationId = 'YOUR_INTEGRATION_ID_HERE';

  /// 1. Authentication Request
  Future<String> authenticate() async {
    final response = await http.post(
      Uri.parse('$_baseUrl/auth/tokens'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'api_key': _apiKey}),
    );
    if (response.statusCode == 201) {
      return jsonDecode(response.body)['token'];
    }
    throw Exception('Paymob Authentication failed');
  }

  /// 2. Order Registration
  Future<int> registerOrder(String authToken, String amountCents, String id) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/ecommerce/orders'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'auth_token': authToken,
        'delivery_needed': 'false',
        'amount_cents': amountCents,
        'currency': 'EGP',
        'merchant_order_id': id,
        'items': [],
      }),
    );
    if (response.statusCode == 201) {
      return jsonDecode(response.body)['id'];
    }
    throw Exception('Paymob Order Registration failed');
  }

  /// 3. Payment Key Request
  Future<String> getPaymentKey(String authToken, int orderId, String amountCents, Map<String, dynamic> billingData) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/acceptance/payment_keys'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'auth_token': authToken,
        'amount_cents': amountCents,
        'expiration': 3600,
        'order_id': orderId.toString(),
        'billing_data': billingData,
        'currency': 'EGP',
        'integration_id': _integrationId,
      }),
    );
    if (response.statusCode == 201) {
      return jsonDecode(response.body)['token'];
    }
    throw Exception('Paymob Payment Key Request failed');
  }

  /// Full flow wrapper (returns the iframe URL)
  Future<String> initiatePayment({
    required String orderId,
    required double amount,
    required Map<String, dynamic> billingData,
  }) async {
    if (_apiKey.contains('YOUR_PAYMOB')) {
      // Return a simulated mock URL if keys aren't set yet
      return 'mock_paymob_url';
    }
    
    final amountCents = (amount * 100).toInt().toString();
    final token = await authenticate();
    final paymobOrderId = await registerOrder(token, amountCents, orderId);
    final paymentKey = await getPaymentKey(token, paymobOrderId, amountCents, billingData);
    
    return 'https://accept.paymob.com/api/acceptance/iframes/$_integrationId?payment_token=$paymentKey';
  }
}
