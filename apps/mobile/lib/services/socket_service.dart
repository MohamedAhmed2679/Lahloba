import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/constants/api_constants.dart';

class SocketService {
  late io.Socket _socket;
  final Map<String, List<Function(dynamic)>> _listeners = {};

  void connect(String token) {
    _socket = io.io(ApiConstants.wsUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'token': token},
    });
    _socket.onConnect((_) => print('[WS] Connected'));
    _socket.onDisconnect((_) => print('[WS] Disconnected'));
    _socket.onError((err) => print('[WS] Error: $err'));
    _socket.connect();
  }

  void joinChannel(String channel) => _socket.emit('join', {'channel': channel});
  void leaveChannel(String channel) => _socket.emit('leave', {'channel': channel});

  void on(String event, Function(dynamic) callback) {
    _listeners[event] ??= [];
    _listeners[event]!.add(callback);
    _socket.on(event, callback);
  }

  void off(String event) {
    _listeners[event]?.forEach((cb) => _socket.off(event, cb));
    _listeners.remove(event);
  }

  void emit(String event, dynamic data) => _socket.emit(event, data);

  void sendForegroundSignal() => _socket.emit('app:foreground', {});

  void disconnect() {
    _socket.disconnect();
    _listeners.clear();
  }

  bool get isConnected => _socket.connected;
}
