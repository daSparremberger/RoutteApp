class DriverUser {
  DriverUser({
    required this.id,
    required this.nome,
    this.email,
    this.telefone,
    this.fotoUrl,
    this.tenantId,
  });

  final int id;
  final String nome;
  final String? email;
  final String? telefone;
  final String? fotoUrl;
  final int? tenantId;

  factory DriverUser.fromJson(Map<String, dynamic> json) {
    return DriverUser(
      id: json['id'] as int,
      nome: json['nome'] as String? ?? '',
      email: json['email'] as String?,
      telefone: json['telefone'] as String?,
      fotoUrl: json['foto_url'] as String?,
      tenantId: json['tenant_id'] as int?,
    );
  }
}
