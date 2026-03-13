class Execucao {
  Execucao({
    required this.id,
    required this.rotaId,
    required this.status,
    this.paradaAtualOrdem,
    this.iniciadaEm,
    this.concluidaEm,
  });

  final int id;
  final int rotaId;
  final String status;
  final int? paradaAtualOrdem;
  final String? iniciadaEm;
  final String? concluidaEm;

  factory Execucao.fromJson(Map<String, dynamic> json) {
    return Execucao(
      id: json['id'] as int,
      rotaId: json['rota_id'] as int,
      status: json['status'] as String? ?? 'em_andamento',
      paradaAtualOrdem: json['parada_atual_ordem'] as int?,
      iniciadaEm: json['iniciada_em'] as String?,
      concluidaEm: json['concluida_em'] as String?,
    );
  }
}
