import type { CrossServiceEvent } from "./events";

export type PessoaTipo =
  | "aluno"
  | "motorista"
  | "responsavel"
  | "operador"
  | "gestor"
  | "cliente_entrega"
  | "passageiro_corp";

export interface Pessoa {
  id: number;
  tenant_id: number;
  firebase_uid?: string;
  tipo: PessoaTipo;
  nome: string;
  email?: string;
  telefone?: string;
  documento?: string;
  endereco?: string;
  lat?: number;
  lng?: number;
  foto_url?: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export type PontoServicoTipo = "escola" | "deposito" | "cliente" | "ponto_coleta";

export interface PontoServico {
  id: number;
  tenant_id: number;
  tipo: PontoServicoTipo;
  nome: string;
  endereco: string;
  lat?: number;
  lng?: number;
  criado_em: string;
  atualizado_em: string;
}

export interface AlunoProfile {
  id: number;
  pessoa_id: number;
  escola_id?: number;
  turno?: "manha" | "tarde" | "noite";
  cpf_responsavel?: string;
  telefone_responsavel?: string;
  responsavel_id?: number;
  serie?: string;
  necessidades_especiais?: string;
  criado_em: string;
}

export interface MotoristaProfile {
  id: number;
  pessoa_id: number;
  cnh?: string;
  categoria_cnh?: string;
  validade_cnh?: string;
  pin_hash?: string;
  documento_url?: string;
  convite_token?: string;
  convite_expira_em?: string;
  cadastro_completo: boolean;
  criado_em: string;
}

export interface EscolaProfile {
  id: number;
  ponto_servico_id: number;
  turno_manha: boolean;
  turno_tarde: boolean;
  turno_noite: boolean;
  horario_entrada_manha?: string;
  horario_saida_manha?: string;
  horario_entrada_tarde?: string;
  horario_saida_tarde?: string;
  horario_entrada_noite?: string;
  horario_saida_noite?: string;
  criado_em: string;
}

export interface Aluno extends Pessoa {
  profile: AlunoProfile;
  nascimento?: string;
  escola_id?: number;
  escola_nome?: string;
  turno?: "manha" | "tarde" | "noite";
  turma?: string;
  ano?: string;
  nome_responsavel?: string;
  cpf_responsavel?: string;
  nascimento_responsavel?: string;
  telefone_responsavel?: string;
  valor_mensalidade?: number;
  meses_contrato?: number;
  inicio_contrato?: string;
  restricoes?: string;
  observacoes?: string;
  face_embeddings?: number[][];
}

export interface Motorista extends Pessoa {
  profile: MotoristaProfile;
  motorista_id?: number;
  cadastro_completo?: boolean;
}

export interface Escola extends PontoServico {
  profile: EscolaProfile;
  turno_manha?: boolean;
  turno_tarde?: boolean;
  turno_noite?: boolean;
  contatos?: EscolaContato[];
}

export interface TenantModule {
  slug: string;
  nome: string;
  tipo: "cadastro" | "operacional" | "suporte";
  habilitado: boolean;
}

export interface ModuleDependency {
  module_slug: string;
  depends_on_slug: string;
  tipo: "required" | "one_of_group";
  grupo?: string;
}

export interface DashboardStats {
  pessoas_total: number;
  veiculos_ativos?: number;
  veiculos_total?: number;
  motoristas_em_acao?: number;
  rotas_hoje?: number;
  alunos_total?: number;
}

export interface DashboardChartData {
  rotas_por_dia?: Array<{ data: string; total: number }>;
  alunos_por_escola?: Array<{ escola: string; total: number }>;
  financeiro_mensal?: Array<{ mes: string; receitas: number; despesas: number }>;
  atividade_por_turno?: Array<{ turno: string; rotas: number }>;
}

export interface AppTokenPayload {
  sub: number;
  tenant_id: number;
  role: "gestor" | "motorista";
  firebase_uid: string;
  nome: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export interface ManagementTokenPayload {
  sub: string;
  role: "superadmin";
  iat?: number;
  exp?: number;
}

export interface Veiculo {
  id: number;
  tenant_id: number;
  placa: string;
  modelo?: string;
  fabricante?: string;
  ano?: number;
  capacidade?: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  motoristas_habilitados?: Motorista[];
  consumo_km?: number;
  rotas_vinculadas?: Rota[];
}

export interface Rota {
  id: number;
  tenant_id: number;
  motorista_id?: number;
  veiculo_id?: number;
  nome: string;
  turno?: "manha" | "tarde" | "noite";
  rota_geojson?: string | Record<string, unknown>;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  veiculo_placa?: string;
  motorista_nome?: string;
  paradas?: RotaParada[];
}

export interface RotaParada {
  id: number;
  rota_id: number;
  pessoa_id: number;
  ordem: number;
  lat?: number;
  lng?: number;
  nome?: string;
  aluno_nome?: string;
  aluno_endereco?: string;
  endereco?: string;
}

export interface RotaHistorico {
  id: number;
  tenant_id: number;
  execucao_id?: number;
  rota_id?: number;
  rota_nome?: string;
  motorista_id?: number;
  motorista_nome?: string;
  veiculo_id?: number;
  veiculo_placa?: string;
  km_total?: number;
  alunos_embarcados: number;
  alunos_pulados: number;
  data_execucao: string;
  data_inicio?: string;
  iniciada_em?: string;
  concluida_em?: string;
  criado_em: string;
}

export interface EscolaContato {
  id?: number;
  nome: string;
  cargo?: string;
  telefone?: string;
  email?: string;
}

export interface Transacao {
  id: number;
  tenant_id: number;
  pessoa_id?: number;
  pessoa_nome?: string;
  mes_referencia: string;
  valor: number;
  status: "pendente" | "pago" | "cancelado";
  criado_em: string;
  data?: string;
  tipo?: "receita" | "despesa";
  categoria?: string;
  descricao?: string;
  aluno_nome?: string;
  pago?: boolean;
}

export interface ResumoFinanceiro {
  receitas: number;
  despesas: number;
  saldo: number;
  inadimplentes: number;
}

export interface Conversa {
  participante_id: number;
  participante_tipo: "gestor" | "motorista";
  participante_nome: string;
  nao_lidas: number;
  ultima_mensagem?: string;
  ultima_mensagem_data?: string;
}

export interface Mensagem {
  id: number;
  tenant_id: number;
  remetente_id: number;
  remetente_tipo: "gestor" | "motorista";
  destinatario_id: number;
  destinatario_tipo: "gestor" | "motorista";
  conteudo: string;
  lido: boolean;
  criado_em: string;
}

export type EventType = CrossServiceEvent | "ERROR_OCCURRED";

export interface DomainEvent<TPayload = unknown> {
  id: string;
  type: EventType;
  payload: TPayload;
  created_at: string;
}

// --- Commercial Platform ---

export interface Organization {
  id: number;
  tenant_id: number;
  razao_social: string;
  cnpj?: string;
  email_financeiro?: string;
  telefone_financeiro?: string;
  endereco_cobranca?: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Contract {
  id: number;
  organization_id: number;
  valor_mensal: number;
  modulos_incluidos: string[];
  max_veiculos: number;
  max_motoristas: number;
  max_gestores: number;
  data_inicio: string;
  data_fim?: string;
  status: "ativo" | "encerrado" | "suspenso";
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface Invoice {
  id: number;
  contract_id: number;
  mes_referencia: string;
  valor: number;
  status: "pendente" | "pago" | "cancelado";
  pago_em?: string;
  observacoes?: string;
  criado_em: string;
}

export interface ComercialDashboard {
  contratos_ativos: number;
  receita_mensal_total: number;
  faturas_pendentes: number;
  valor_faturas_pendentes: number;
  contratos_vencendo_30d: number;
}

export interface EntregaProfile {
  id: number;
  pessoa_id: number;
  empresa?: string;
  tipo_carga?: string;
  peso_max_kg?: number;
  instrucoes?: string;
  contato_recebedor?: string;
  criado_em: string;
}

export interface ClienteEntrega extends Pessoa {
  profile: EntregaProfile;
}

export interface PassageiroCorporativoProfile {
  id: number;
  pessoa_id: number;
  empresa?: string;
  cargo?: string;
  centro_custo?: string;
  horario_entrada?: string;
  horario_saida?: string;
  criado_em: string;
}

export interface PassageiroCorporativo extends Pessoa {
  profile: PassageiroCorporativoProfile;
}
