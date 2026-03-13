import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/routes.dart';
import '../providers/route_provider.dart';
import '../widgets/route_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RouteProvider>().loadRoutes();
    });
  }

  @override
  Widget build(BuildContext context) {
    final routes = context.watch<RouteProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rotas de Hoje'),
        actions: [
          IconButton(
            onPressed: () => Navigator.pushNamed(context, AppRoutes.profile),
            icon: const Icon(Icons.person_outline),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: routes.loadRoutes,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (routes.isLoading) const LinearProgressIndicator(),
            ...routes.rotas.map(
              (rota) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: RouteCard(
                  rota: rota,
                  onTap: () async {
                    await routes.loadRouteDetail(rota.id);
                    if (context.mounted) {
                      Navigator.pushNamed(context, AppRoutes.routeDetail);
                    }
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
