import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_service.dart';
import 'auth_service.dart';

class NotificationService {
  NotificationService({required ApiService apiService, required AuthService authService})
      : _apiService = apiService,
        _authService = authService;

  final ApiService _apiService;
  final AuthService _authService;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    await _messaging.requestPermission();
    await _localNotifications.initialize(const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    ));

    final token = await _messaging.getToken();
    final jwt = await _authService.getJwt();
    if (token != null && jwt != null) {
      await _apiService.registerDeviceToken(token);
    }

    FirebaseMessaging.onMessage.listen((message) async {
      final notification = message.notification;
      if (notification == null) return;

      await _localNotifications.show(
        notification.hashCode,
        notification.title,
        notification.body,
        const NotificationDetails(
          android: AndroidNotificationDetails('rotavans', 'RotaVans'),
          iOS: DarwinNotificationDetails(),
        ),
      );
    });
  }
}
