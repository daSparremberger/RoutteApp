import { Bell, Menu, MessageCircle, Search } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuthStore } from '../../stores/auth';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';

const searchablePages = [
  { route: '/dashboard', terms: ['dashboard', 'painel', 'inicio', 'início'] },
  { route: '/escolas', terms: ['escola', 'escolas'] },
  { route: '/alunos', terms: ['aluno', 'alunos'] },
  { route: '/motoristas', terms: ['motorista', 'motoristas'] },
  { route: '/veiculos', terms: ['veiculo', 'veículo', 'veiculos', 'veículos'] },
  { route: '/rotas', terms: ['rota', 'rotas'] },
  { route: '/rastreamento', terms: ['rastreamento', 'ao vivo', 'mapa'] },
  { route: '/historico', terms: ['historico', 'histórico'] },
  { route: '/financeiro', terms: ['financeiro', 'receitas', 'despesas'] },
  { route: '/mensagens', terms: ['mensagem', 'mensagens', 'chat'] },
  { route: '/perfil', terms: ['perfil', 'conta'] },
  { route: '/configuracoes', terms: ['configuracoes', 'configurações', 'ajustes'] },
];

interface HeaderProps {
  onOpenMenu?: () => void;
}

function normalizeText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function Header({ onOpenMenu }: HeaderProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const normalizedQuery = useMemo(() => normalizeText(query), [query]);

  function handleSearch() {
    if (!normalizedQuery) return;

    const match = searchablePages.find((page) =>
      page.terms.some((term) => normalizeText(term).includes(normalizedQuery) || normalizedQuery.includes(normalizeText(term)))
    );

    if (match) {
      navigate(match.route);
    }
  }

  return (
    <header className="flex h-[76px] items-center justify-between border-b border-border/80 px-3 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface2 text-text md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>

        <label className="relative block w-full" htmlFor="header-search">
          <Search
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            id="header-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearch();
            }}
            placeholder="Pesquisar página..."
            className="h-11 w-full rounded-full border border-border bg-surface2 pl-10 pr-20 text-sm text-text placeholder:text-text-muted transition-all duration-200 focus:border-success focus:outline-none md:pl-11 md:pr-24"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-surface transition-colors hover:bg-accent-hover md:px-4"
          >
            Buscar
          </button>
        </label>
      </div>

      <div className="ml-2 flex items-center gap-2 md:ml-3 md:gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface2 p-1">
          <ThemeToggle />

          <button className="relative hidden h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-surface md:flex">
            <Bell size={18} strokeWidth={1.5} className="text-text-muted" />
          </button>

          <button className="relative hidden h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-surface md:flex">
            <MessageCircle size={18} strokeWidth={1.5} className="text-text-muted" />
          </button>
        </div>

        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-surface2">
          {user?.nome ? (
            <span className="text-sm font-semibold text-text">{user.nome.charAt(0).toUpperCase()}</span>
          ) : (
            <span className="text-sm font-medium text-text-muted">?</span>
          )}
        </div>
      </div>
    </header>
  );
}
