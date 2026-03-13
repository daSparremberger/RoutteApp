class Parada {
  Parada({
    required this.id,
    required this.ordem,
    this.lat,
    this.lng,
    this.alunoNome,
    this.alunoEndereco,
    this.alunoFotoUrl,
    this.status,
  });

  final int id;
  final int ordem;
  final double? lat;
  final double? lng;
  final String? alunoNome;
  final String? alunoEndereco;
  final String? alunoFotoUrl;
  final String? status;

  factory Parada.fromJson(Map<String, dynamic> json) {
    return Parada(
      id: json['id'] as int,
      ordem: json['ordem'] as int? ?? 0,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      alunoNome: json['aluno_nome'] as String?,
      alunoEndereco: json['aluno_endereco'] as String?,
      alunoFotoUrl: json['aluno_foto_url'] as String?,
      status: json['status'] as String?,
    );
  }
}
