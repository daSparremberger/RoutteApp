import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../models/user.dart';
import 'storage_service.dart';

class AuthSession {
  AuthSession({required this.token, required this.refreshToken, required this.user});

  final String token;
  final String refreshToken;
  final DriverUser user;
}

class AuthService {
  AuthService({required StorageService storageService}) : _storageService = storageService;

  final StorageService _storageService;
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;
  bool _googleInitialized = false;

  Future<String?> getJwt() => _storageService.readSecure('app_jwt');

  Future<AuthSession> signInWithGoogle() async {
    if (!_googleInitialized) {
      await _googleSignIn.initialize();
      _googleInitialized = true;
    }

    final account = await _googleSignIn.authenticate();
    final auth = account.authentication;
    final credential = GoogleAuthProvider.credential(
      idToken: auth.idToken,
    );

    final userCredential = await _firebaseAuth.signInWithCredential(credential);
    final idToken = await userCredential.user?.getIdToken();

    if (idToken == null) {
      throw Exception('Nao foi possivel obter token do Firebase.');
    }

    return exchangeForJwt(idToken);
  }

  Future<AuthSession> exchangeForJwt(String firebaseIdToken) async {
    final user = DriverUser(id: 0, nome: 'Motorista', tenantId: null);
    final session = AuthSession(token: firebaseIdToken, refreshToken: '', user: user);
    await storeTokens(session.token, session.refreshToken);
    return session;
  }

  Future<void> storeTokens(String jwt, String refresh) async {
    await _storageService.writeSecure('app_jwt', jwt);
    await _storageService.writeSecure('app_refresh', refresh);
  }

  Future<void> logout() async {
    await _storageService.deleteSecure('app_jwt');
    await _storageService.deleteSecure('app_refresh');
    await _firebaseAuth.signOut();
    await _googleSignIn.signOut();
  }

  Future<bool> get isAuthenticated async => (await getJwt()) != null;
}
