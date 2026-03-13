import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'config/routes.dart';
import 'providers/auth_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/navigation_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/route_detail_screen.dart';
import 'screens/stop_action_screen.dart';

class RotavansApp extends StatelessWidget {
  const RotavansApp({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return MaterialApp(
      title: 'RotaVans Motorista',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1565C0),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF4F7FB),
        useMaterial3: true,
      ),
      initialRoute: auth.isAuthenticated ? AppRoutes.home : AppRoutes.login,
      routes: {
        AppRoutes.login: (_) => const LoginScreen(),
        AppRoutes.home: (_) => const HomeScreen(),
        AppRoutes.routeDetail: (_) => const RouteDetailScreen(),
        AppRoutes.navigation: (_) => const NavigationScreen(),
        AppRoutes.stopAction: (_) => const StopActionScreen(),
        AppRoutes.profile: (_) => const ProfileScreen(),
      },
    );
  }
}
