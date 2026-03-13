import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/routes.dart';
import '../providers/auth_provider.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CircleAvatar(
              radius: 36,
              child: Text(user?.nome.characters.firstOrNull?.toUpperCase() ?? 'M'),
            ),
            const SizedBox(height: 12),
            Text(user?.nome ?? 'Motorista', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(user?.email ?? 'Sem email'),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () async {
                await auth.logout();
                if (context.mounted) {
                  Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (_) => false);
                }
              },
              child: const Text('Sair'),
            ),
          ],
        ),
      ),
    );
  }
}
