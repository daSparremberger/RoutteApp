import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'providers/auth_provider.dart';
import 'providers/location_provider.dart';
import 'providers/route_provider.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'services/location_service.dart';
import 'services/notification_service.dart';
import 'services/socket_service.dart';
import 'services/storage_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Firebase config is environment-specific and may be absent in local bootstrap.
  }

  final storageService = StorageService();
  final authService = AuthService(storageService: storageService);
  final apiService = ApiService(authService: authService);
  final socketService = SocketService(authService: authService);
  final locationService = LocationService();
  final notificationService = NotificationService(
    apiService: apiService,
    authService: authService,
  );

  await notificationService.initialize();

  runApp(
    MultiProvider(
      providers: [
        Provider.value(value: storageService),
        Provider.value(value: authService),
        Provider.value(value: apiService),
        Provider.value(value: socketService),
        Provider.value(value: locationService),
        Provider.value(value: notificationService),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(authService: authService)..restoreSession(),
        ),
        ChangeNotifierProvider(
          create: (_) => RouteProvider(apiService: apiService, socketService: socketService),
        ),
        ChangeNotifierProvider(
          create: (_) => LocationProvider(locationService: locationService),
        ),
      ],
      child: const RotavansApp(),
    ),
  );
}
