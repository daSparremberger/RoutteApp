import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  School,
  Users,
  Truck,
  Car,
  Map,
  History,
  DollarSign,
  Radio,
  MessageCircle,
  LogOut,
  Settings,
  UserCircle,
  LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { clsx } from 'clsx';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    label: 'Principal',
    items: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    label: 'Cadastros',
    items: [
      { to: '/escolas', icon: School, label: 'Escolas' },
      { to: '/alunos', icon: Users, label: 'Alunos' },
      { to: '/motoristas', icon: Truck, label: 'Motoristas' },
      { to: '/veiculos', icon: Car, label: 'Veículos' },
    ],
  },
  {
    label: 'Operações',
    items: [
      { to: '/rotas', icon: Map, label: 'Rotas' },
      { to: '/rastreamento', icon: Radio, label: 'Ao Vivo' },
      { to: '/historico', icon: History, label: 'Histórico' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
      { to: '/mensagens', icon: MessageCircle, label: 'Mensagens' },
    ],
  },
];

export const bottomNav: NavItem[] = [
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
  { to: '/perfil', icon: UserCircle, label: 'Perfil' },
];

interface SidebarContentProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function SidebarContent({ mobile = false, onNavigate }: SidebarContentProps) {
  const { logout } = useAuthStore();

  return (
    <>
      <div className="flex h-[76px] items-center px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent">
          <span className="text-sm font-bold text-surface">R</span>
        </div>
        <span className={clsx('ml-3 font-semibold text-text', mobile ? 'inline' : 'hidden xl:inline')}>
          RotaVans
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        {navigation.map((section, idx) => (
          <div key={section.label} className={clsx(idx > 0 && 'mt-6')}>
            <span
              className={clsx(
                'px-3 text-[11px] font-medium uppercase tracking-wider text-text-muted',
                mobile ? 'block' : 'hidden xl:block'
              )}
            >
              {section.label}
            </span>
            <div className="mt-2 space-y-1.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      mobile ? 'justify-start gap-3' : 'md:justify-center xl:justify-start',
                      isActive
                        ? 'bg-surface text-text shadow-[0_8px_20px_rgba(16,18,20,0.08)]'
                        : 'text-text-muted hover:bg-surface hover:text-text'
                    )
                  }
                >
                  <item.icon size={18} strokeWidth={1.5} />
                  <span className={mobile ? 'inline' : 'hidden xl:inline'}>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4">
        <div className="rounded-2xl bg-surface p-2">
          {bottomNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  'flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  mobile ? 'justify-start gap-3' : 'md:justify-center xl:justify-start',
                  isActive
                    ? 'bg-surface2 text-text'
                    : 'text-text-muted hover:text-text hover:bg-surface2'
                )
              }
            >
              <item.icon size={18} strokeWidth={1.5} />
              <span className={mobile ? 'inline' : 'hidden xl:inline'}>{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => {
              logout();
              onNavigate?.();
            }}
            className={clsx(
              'w-full rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-all duration-150 hover:bg-danger-muted hover:text-danger',
              mobile ? 'flex items-center justify-start gap-3' : 'md:flex md:items-center md:justify-center xl:justify-start xl:gap-3'
            )}
          >
            <LogOut size={18} strokeWidth={1.5} />
            <span className={mobile ? 'inline' : 'hidden xl:inline'}>Sair</span>
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden h-full shrink-0 flex-col rounded-[28px] border border-border bg-surface2 md:flex md:w-[88px] xl:w-[248px]">
      <SidebarContent />
    </aside>
  );
}
