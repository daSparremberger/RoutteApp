import 'package:flutter/foundation.dart';

import '../models/rota.dart';
import 'package:mobile/services/api_service.dart';
import 'package:mobile/services/socket_service.dart';

class RouteProvider extends ChangeNotifier {
  RouteProvider({required ApiService apiService, required SocketService socketService})
      : _apiService = apiService,
        _socketService = socketService;

  final ApiService _apiService;
  final SocketService _socketService;

  List<Rota> rotas = const [];
  Rota? rotaAtual;
  bool isLoading = false;

  Future<void> loadRoutes() async {
    isLoading = true;
    notifyListeners();
    try {
      rotas = await _apiService.getMinhasRotas();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadRouteDetail(int rotaId) async {
    rotaAtual = await _apiService.getRotaDetalhes(rotaId);
    notifyListeners();
  }

  Future<void> startExecution() async {
    if (rotaAtual == null) return;
    await _apiService.iniciarExecucao(rotaAtual!.id);
    await _socketService.connect();
  }
}
