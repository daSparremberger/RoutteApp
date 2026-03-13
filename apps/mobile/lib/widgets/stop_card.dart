import 'package:flutter/material.dart';

import '../models/parada.dart';

class StopCard extends StatelessWidget {
  const StopCard({super.key, required this.parada});

  final Parada parada;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(child: Text('${parada.ordem}')),
        title: Text(parada.alunoNome ?? 'Parada'),
        subtitle: Text(parada.alunoEndereco ?? 'Sem endereco'),
      ),
    );
  }
}
