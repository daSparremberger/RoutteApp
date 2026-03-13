import 'package:flutter/material.dart';

import '../models/rota.dart';
import 'status_badge.dart';

class RouteCard extends StatelessWidget {
  const RouteCard({super.key, required this.rota, required this.onTap});

  final Rota rota;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        onTap: onTap,
        title: Text(rota.nome),
        subtitle: Text('${rota.escolaNome ?? 'Sem escola'} • ${rota.paradas.length} parada(s)'),
        trailing: StatusBadge(label: rota.status ?? 'pendente'),
      ),
    );
  }
}
