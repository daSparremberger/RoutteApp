import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider({required AuthService authService}) : _authService = authService;

  final AuthService _authService;
  DriverUser? user;
  bool isLoading = false;

  bool get isAuthenticated => user != null;

  Future<void> restoreSession() async {
    final token = await _authService.getJwt();
    if (token != null) {
      user = DriverUser(id: 0, nome: 'Motorista');
      notifyListeners();
    }
  }

  Future<void> signInWithGoogle() async {
    isLoading = true;
    notifyListeners();
    try {
      final session = await _authService.signInWithGoogle();
      user = session.user;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    user = null;
    notifyListeners();
  }
}
