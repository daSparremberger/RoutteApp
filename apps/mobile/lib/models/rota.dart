import 'parada.dart';

class Rota {
  Rota({
    required this.id,
    required this.nome,
    this.escolaNome,
    this.periodo,
    this.horarioSaida,
    this.status,
    this.paradas = const [],
  });

  final int id;
  final String nome;
  final String? escolaNome;
  final String? periodo;
  final String? horarioSaida;
  final String? status;
  final List<Parada> paradas;

  factory Rota.fromJson(Map<String, dynamic> json) {
    final paradas = (json['paradas'] as List<dynamic>? ?? [])
        .map((item) => Parada.fromJson(item as Map<String, dynamic>))
        .toList();

    return Rota(
      id: json['id'] as int,
      nome: json['nome'] as String? ?? '',
      escolaNome: json['escola_nome'] as String?,
      periodo: json['periodo'] as String? ?? json['turno'] as String?,
      horarioSaida: json['horario_saida'] as String?,
      status: json['status'] as String?,
      paradas: paradas,
    );
  }
}
