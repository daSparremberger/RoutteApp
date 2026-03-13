import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/routes.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.alt_route, size: 64, color: Color(0xFF1565C0)),
              const SizedBox(height: 16),
              Text(
                'RotaVans Motorista',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                'Entrar com Google e sincronizar suas rotas do dia.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: auth.isLoading
                    ? null
                    : () async {
                        await auth.signInWithGoogle();
                        if (context.mounted && auth.isAuthenticated) {
                          Navigator.pushReplacementNamed(context, AppRoutes.home);
                        }
                      },
                icon: auth.isLoading
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.login),
                label: const Text('Entrar com Google'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
