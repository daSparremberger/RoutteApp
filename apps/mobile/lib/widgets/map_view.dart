import 'package:flutter/material.dart';

import '../models/rota.dart';

class MapView extends StatelessWidget {
  const MapView({super.key, required this.rota});

  final Rota? rota;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFFDDE7F3),
      child: Center(
        child: Text(rota == null ? 'Mapa indisponivel' : 'Mapa da rota ${rota!.nome}'),
      ),
    );
  }
}
