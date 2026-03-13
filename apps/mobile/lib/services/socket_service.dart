import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/env.dart';
import 'auth_service.dart';

class SocketService {
  SocketService({required AuthService authService}) : _authService = authService;

  final AuthService _authService;
  io.Socket? _socket;

  Future<void> connect() async {
    final token = await _authService.getJwt();
    _socket = io.io(
      Env.socketUrl,
      io.OptionBuilder().setTransports(['websocket']).setAuth({'token': token}).disableAutoConnect().build(),
    );
    _socket?.connect();
  }

  void startTracking({required int execucaoId, required double lat, required double lng}) {
    _socket?.emit('location_update', {
      'execucao_id': execucaoId,
      'lat': lat,
      'lng': lng,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  void stopTracking() {
    _socket?.disconnect();
  }
}
