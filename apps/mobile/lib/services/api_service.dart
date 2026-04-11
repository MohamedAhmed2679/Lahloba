import 'package:dio/dio.dart';
import '../core/constants/api_constants.dart';

class ApiService {
  late final Dio _dio;

  ApiService({String? token}) {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: ApiConstants.timeout,
      receiveTimeout: ApiConstants.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    ));
    _dio.interceptors.add(LogInterceptor(requestBody: true, responseBody: true));
  }

  void setToken(String token) => _dio.options.headers['Authorization'] = 'Bearer $token';
  void setLocale(String locale) => _dio.options.headers['Accept-Language'] = locale;

  // ── Auth ──
  Future<Response> requestOtp(String phone) => _dio.post('/auth/otp/request', data: {'phone': phone});
  Future<Response> verifyOtp(String phone, String code) => _dio.post('/auth/otp/verify', data: {'phone': phone, 'code': code});

  // ── Meals ──
  Future<Response> getMeals({int page = 1, int pageSize = 20, String? type}) =>
      _dio.get('/meals', queryParameters: {'page': page, 'page_size': pageSize, if (type != null) 'type': type});
  Future<Response> getMeal(String id) => _dio.get('/meals/$id');

  // ── Ingredient Combos ──
  Future<Response> computeCombos({required String mealId, required int servings, required String addressId, required String scheduledAt}) =>
      _dio.post('/ingredient-combos/compute', data: {'meal_id': mealId, 'servings': servings, 'address_id': addressId, 'scheduled_at': scheduledAt});

  // ── Orders ──
  Future<Response> createOrder(Map<String, dynamic> data) => _dio.post('/orders', data: data);
  Future<Response> getOrder(String id) => _dio.get('/orders/$id');
  Future<Response> getMyOrders({int page = 1}) => _dio.get('/orders', queryParameters: {'page': page});

  // ── Chat ──
  Future<Response> getChatRooms() => _dio.get('/chat/rooms');
  Future<Response> getChatMessages(String roomId, {int page = 1}) => _dio.get('/chat/rooms/$roomId/messages', queryParameters: {'page': page});
  Future<Response> sendMessage(String roomId, Map<String, dynamic> data) => _dio.post('/chat/rooms/$roomId/messages', data: data);

  // ── Ratings ──
  Future<Response> submitRating(Map<String, dynamic> data) => _dio.post('/ratings', data: data);

  // ── Support ──
  Future<Response> createTicket(Map<String, dynamic> data) => _dio.post('/support/tickets', data: data);

  // ── Payments ──
  Future<Response> createPaymentIntent(Map<String, dynamic> data) => _dio.post('/payments/intent', data: data);

  // ── User ──
  Future<Response> getProfile() => _dio.get('/users/me');
  Future<Response> updateProfile(Map<String, dynamic> data) => _dio.patch('/users/me', data: data);
  Future<Response> getAddresses() => _dio.get('/users/me/addresses');
  Future<Response> addAddress(Map<String, dynamic> data) => _dio.post('/users/me/addresses', data: data);

  // ── Delivery (driver role) ──
  Future<Response> getAvailableTasks() => _dio.get('/delivery/tasks', queryParameters: {'status': 'AVAILABLE'});
  Future<Response> acceptTask(String taskId) => _dio.post('/delivery/tasks/$taskId/accept');
  Future<Response> updateTaskStatus(String taskId, String status) => _dio.patch('/delivery/tasks/$taskId', data: {'status': status});
  Future<Response> confirmStop(String stopId, String otp) => _dio.post('/delivery/stops/$stopId/confirm', data: {'otp': otp});

  // ── Store (store role) ──
  Future<Response> getStoreFulfillments() => _dio.get('/store-fulfillments/mine');
  Future<Response> markReady(String sfId) => _dio.post('/store-fulfillments/$sfId/ready');
  Future<Response> proposeSubstitution(String sfId, Map<String, dynamic> data) => _dio.post('/store-fulfillments/$sfId/substitutions', data: data);
}
