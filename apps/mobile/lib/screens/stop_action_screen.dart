import 'package:flutter/material.dart';

class StopActionScreen extends StatelessWidget {
  const StopActionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Acao da Parada')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Card(
              child: ListTile(
                title: Text('Aluno'),
                subtitle: Text('Confirme embarque, desembarque ou pulo da parada.'),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Registrar Embarque')),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text('Registrar Desembarque')),
            const SizedBox(height: 12),
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Pular Parada')),
          ],
        ),
      ),
    );
  }
}
