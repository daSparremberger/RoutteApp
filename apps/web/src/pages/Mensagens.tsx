import { useEffect, useState, useRef } from 'react';
import { MessageCircle, Send, User } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { clsx } from 'clsx';
import type { Conversa, Mensagem, Motorista } from '@rotavans/shared';

export function Mensagens() {
  const { user } = useAuthStore();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversa | null>(null);
  const [messages, setMessages] = useState<Mensagem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversas();
    loadMotoristas();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadConversas() {
    try {
      const data = await api.get<Conversa[]>('/mensagens/conversas');
      setConversas(data);
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMotoristas() {
    try {
      const data = await api.get<Motorista[]>('/motoristas');
      setMotoristas(data.filter(m => m.cadastro_completo && m.ativo));
    } catch (err) {
      console.error('Erro ao carregar motoristas:', err);
    }
  }

  async function loadMessages(conversa: Conversa) {
    try {
      const data = await api.get<Mensagem[]>(
        `/mensagens/conversa/${conversa.participante_tipo}/${conversa.participante_id}`
      );
      setMessages(data);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      const mensagem = await api.post<Mensagem>('/mensagens', {
        destinatario_id: selectedConversation.participante_id,
        destinatario_tipo: selectedConversation.participante_tipo,
        conteudo: newMessage.trim(),
      });
      setMessages([...messages, mensagem]);
      setNewMessage('');
      loadConversas();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function startConversation(motorista: Motorista) {
    const existing = conversas.find(
      c => c.participante_id === motorista.id && c.participante_tipo === 'motorista'
    );
    if (existing) {
      setSelectedConversation(existing);
    } else {
      setSelectedConversation({
        participante_id: motorista.id,
        participante_tipo: 'motorista',
        participante_nome: motorista.nome,
        nao_lidas: 0,
      });
      setMessages([]);
    }
  }

  const motoristasWithoutConvo = motoristas.filter(
    m => !conversas.some(c => c.participante_id === m.id && c.participante_tipo === 'motorista')
  );

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  return (
    <PageTransition>
      <div className="flex h-full min-h-0 flex-col">
        <PageHeader title="Mensagens" subtitle="Comunicação com motoristas" />

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Left column - Conversations list */}
          <div className="w-full border border-border/30 rounded-xl flex min-h-[280px] flex-col overflow-hidden lg:w-80 lg:min-h-0">
            <div className="p-4 border-b border-border/30">
              <h2 className="text-sm font-semibold text-text">Conversas</h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-text-muted text-sm">Carregando...</div>
              ) : conversas.length === 0 && motoristasWithoutConvo.length === 0 ? (
                <div className="p-4 text-center text-text-muted text-sm">
                  Nenhuma conversa ou motorista disponível
                </div>
              ) : (
                <>
                  {/* Active conversations */}
                  {conversas.map((conversa) => (
                    <button
                      key={`${conversa.participante_tipo}-${conversa.participante_id}`}
                      onClick={() => setSelectedConversation(conversa)}
                      className={clsx(
                        'w-full p-4 flex items-start gap-3 hover:bg-surface2/50 transition-colors text-left border-b border-border/30',
                        selectedConversation?.participante_id === conversa.participante_id &&
                          selectedConversation?.participante_tipo === conversa.participante_tipo &&
                          'bg-surface2'
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                        <User size={18} className="text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-text text-sm font-medium truncate">
                            {conversa.participante_nome}
                          </span>
                          {conversa.nao_lidas > 0 && (
                            <span className="bg-accent text-surface text-xs px-2 py-0.5 rounded-full shrink-0">
                              {conversa.nao_lidas}
                            </span>
                          )}
                        </div>
                        {conversa.ultima_mensagem && (
                          <p className="text-text-muted text-xs mt-1 truncate">
                            {conversa.ultima_mensagem}
                          </p>
                        )}
                        {conversa.ultima_mensagem_data && (
                          <p className="text-text-muted text-xs mt-0.5">
                            {formatTime(conversa.ultima_mensagem_data)}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* Motoristas without conversations */}
                  {motoristasWithoutConvo.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-surface2/30 text-xs text-text-muted font-medium">
                        Iniciar nova conversa
                      </div>
                      {motoristasWithoutConvo.map((motorista) => (
                        <button
                          key={`new-${motorista.id}`}
                          onClick={() => startConversation(motorista)}
                          className="w-full p-4 flex items-center gap-3 hover:bg-surface2/50 transition-colors text-left border-b border-border/30"
                        >
                          <div className="w-10 h-10 rounded-full bg-surface3 flex items-center justify-center shrink-0">
                            <User size={18} className="text-text-muted" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-text-muted text-sm truncate">{motorista.nome}</span>
                            <p className="text-text-muted text-xs mt-0.5">Clique para iniciar</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right column - Chat */}
          <div className="flex-1 border border-border/30 rounded-xl flex min-h-[360px] flex-col overflow-hidden lg:min-h-0">
            {selectedConversation ? (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-border/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <User size={18} className="text-accent" />
                  </div>
                  <div>
                    <h2 className="text-text font-medium">
                      {selectedConversation.participante_nome}
                    </h2>
                    <p className="text-text-muted text-xs capitalize">
                      {selectedConversation.participante_tipo}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-text-muted text-sm">Nenhuma mensagem ainda</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isFromMe = msg.remetente_tipo === 'gestor' && msg.remetente_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={clsx('flex', isFromMe ? 'justify-end' : 'justify-start')}
                        >
                          <div
                            className={clsx(
                              'max-w-[70%] px-4 py-2 rounded-2xl',
                              isFromMe
                                ? 'bg-accent text-surface rounded-br-sm'
                                : 'bg-surface2 text-text rounded-bl-sm'
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.conteudo}</p>
                            <p className="text-xs mt-1 text-text-muted">
                              {formatTime(msg.criado_em)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-border/30">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 ui-input placeholder:text-text-muted"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className={clsx(
                        'px-4 py-3 rounded-xl transition-colors',
                        newMessage.trim() && !sending
                          ? 'bg-accent hover:bg-accent-hover text-surface'
                          : 'bg-surface2 text-text-muted cursor-not-allowed'
                      )}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                icon={MessageCircle}
                message="Selecione uma conversa para começar"
              />
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
