import 'dart:io';

import 'package:dio/dio.dart';

import '../config/env.dart';
import '../models/rota.dart';
import '../models/user.dart';
import 'auth_service.dart';

class ApiService {
  ApiService({required AuthService authService})
      : _authService = authService,
        _dio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl)) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _authService.getJwt();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final AuthService _authService;
  final Dio _dio;

  Future<DriverUser> getProfile() async {
    final response = await _dio.get<Map<String, dynamic>>('/auth/profile');
    return DriverUser.fromJson(response.data ?? const {});
  }

  Future<List<Rota>> getMinhasRotas() async {
    final response = await _dio.get<List<dynamic>>('/motorista/rotas');
    return (response.data ?? [])
        .map((item) => Rota.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Rota> getRotaDetalhes(int id) async {
    final response = await _dio.get<Map<String, dynamic>>('/motorista/rotas/$id');
    return Rota.fromJson(response.data ?? const {});
  }

  Future<Response<dynamic>> iniciarExecucao(int rotaId) => _dio.post('/execucao/iniciar', data: {'rota_id': rotaId});
  Future<Response<dynamic>> registrarEmbarque(Map<String, dynamic> data) => _dio.post('/execucao/embarque', data: data);
  Future<Response<dynamic>> registrarDesembarque(Map<String, dynamic> data) => _dio.post('/execucao/desembarque', data: data);
  Future<Response<dynamic>> pularParada(Map<String, dynamic> data) => _dio.post('/execucao/pular', data: data);
  Future<Response<dynamic>> concluirExecucao(int id) => _dio.post('/execucao/$id/finalizar');

  Future<Response<dynamic>> uploadFile(File file) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(file.path, filename: file.uri.pathSegments.last),
    });
    return _dio.post('/uploads', data: formData);
  }

  Future<Response<dynamic>> registerDeviceToken(String token) {
    return _dio.post('/device-tokens', data: {'token': token, 'platform': Platform.isAndroid ? 'android' : 'ios'});
  }
}
