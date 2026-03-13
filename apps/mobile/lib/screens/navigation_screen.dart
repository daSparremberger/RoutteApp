import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/routes.dart';
import '../providers/location_provider.dart';
import '../providers/route_provider.dart';
import '../widgets/map_view.dart';

class NavigationScreen extends StatefulWidget {
  const NavigationScreen({super.key});

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LocationProvider>().start();
    });
  }

  @override
  Widget build(BuildContext context) {
    final routeProvider = context.watch<RouteProvider>();
    final rota = routeProvider.rotaAtual;

    return Scaffold(
      appBar: AppBar(title: const Text('Navegacao')),
      body: Column(
        children: [
          Expanded(child: MapView(rota: rota)),
          if (rota != null && rota.paradas.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Card(
                child: ListTile(
                  title: Text(rota.paradas.first.alunoNome ?? 'Proxima parada'),
                  subtitle: Text(rota.paradas.first.alunoEndereco ?? 'Sem endereco'),
                  trailing: FilledButton(
                    onPressed: () => Navigator.pushNamed(context, AppRoutes.stopAction),
                    child: const Text('Cheguei'),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
