class ApiConstants {
  ApiConstants._();
  static const baseUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:3000/v1');
  static const wsUrl = String.fromEnvironment('WS_URL', defaultValue: 'ws://localhost:3001');
  static const timeout = Duration(seconds: 30);
}
