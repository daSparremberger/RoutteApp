import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/routes.dart';
import '../providers/route_provider.dart';
import '../widgets/stop_card.dart';

class RouteDetailScreen extends StatelessWidget {
  const RouteDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final routeProvider = context.watch<RouteProvider>();
    final rota = routeProvider.rotaAtual;

    return Scaffold(
      appBar: AppBar(title: Text(rota?.nome ?? 'Detalhes da Rota')),
      body: rota == null
          ? const Center(child: Text('Nenhuma rota carregada.'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: ListTile(
                    title: Text(rota.nome),
                    subtitle: Text('${rota.escolaNome ?? 'Sem escola'} • ${rota.periodo ?? 'Sem periodo'}'),
                  ),
                ),
                const SizedBox(height: 16),
                ...rota.paradas.map((parada) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: StopCard(parada: parada),
                    )),
              ],
            ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: rota == null
              ? null
              : () async {
                  await routeProvider.startExecution();
                  if (context.mounted) {
                    Navigator.pushNamed(context, AppRoutes.navigation);
                  }
                },
          child: const Text('Iniciar Rota'),
        ),
      ),
    );
  }
}
