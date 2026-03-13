import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { useModulesStore } from './stores/modules';
import { useThemeStore } from './stores/theme';
import { Layout } from './components/layout/Layout';
import { LoginPage as Login } from './pages/Login';
import { ConvitePage } from './pages/Convite';
import { Dashboard } from './pages/Dashboard';
import { Escolas } from './pages/Escolas';
import { Alunos } from './pages/Alunos';
import { Motoristas } from './pages/Motoristas';
import { Entregas } from './pages/Entregas';
import { PassageirosCorporativos } from './pages/PassageirosCorporativos';
import { Rotas } from './pages/Rotas';
import { Veiculos } from './pages/Veiculos';
import { Historico } from './pages/Historico';
import { Financeiro } from './pages/Financeiro';
import { Rastreamento } from './pages/Rastreamento';
import { Mensagens } from './pages/Mensagens';
import { Perfil } from './pages/Perfil';
import { Configuracoes } from './pages/Configuracoes';
import { AdminLayout } from './pages/Admin';
import { AdminDashboard } from './pages/Admin/Dashboard';
import { TenantsPage } from './pages/Admin/Tenants';
import { TenantFormPage } from './pages/Admin/TenantForm';
import { OrganizationsPage } from './pages/Admin/Organizations';
import { OrganizationDetailPage } from './pages/Admin/OrganizationDetail';
import { InvoicesPage } from './pages/Admin/Invoices';
import { DownloadsPage } from './pages/Downloads';
import { useEffect } from 'react';
import { ElectronFrame } from './components/layout/ElectronFrame';
import { appApi } from './lib/api';

function ProtectedRoute({
  children,
  allowedRoles,
  requiredModule,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
  requiredModule?: string;
}) {
  const { role } = useAuthStore();
  const hasModule = useModulesStore((s) => s.hasModule);
  if (!role) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to="/" replace />;
  if (requiredModule && role !== 'admin' && !hasModule(requiredModule)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function RootRedirect() {
  const { role } = useAuthStore();
  if (!role) return <Navigate to="/login" replace />;
  if (role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  // Initialize theme on mount
  const { theme } = useThemeStore();
  const { role, token, scope } = useAuthStore();
  const setModules = useModulesStore((s) => s.setModules);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (role !== 'gestor' || !token || scope !== 'app') return;

    appApi.get<{ modules: string[] }>('/auth/profile')
      .then((data) => setModules(data.modules || []))
      .catch(() => {});
  }, [role, token, scope, setModules]);

  return (
    <>
      <ElectronFrame />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/convite/:token" element={<ConvitePage />} />
        <Route path="/downloads" element={<DownloadsPage />} />

        {/* Root redirect based on role */}
        <Route path="/" element={<RootRedirect />} />

        {/* Admin routes */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="tenants/:id" element={<TenantFormPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="organizations/:id" element={<OrganizationDetailPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
        </Route>

        {/* Gestor routes */}
        <Route element={
          <ProtectedRoute allowedRoles={['gestor']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="escolas" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="escolas"><Escolas /></ProtectedRoute>} />
          <Route path="alunos" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="alunos"><Alunos /></ProtectedRoute>} />
          <Route path="entregas" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="entregas"><Entregas /></ProtectedRoute>} />
          <Route path="passageiros-corporativos" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="passageiros_corporativos"><PassageirosCorporativos /></ProtectedRoute>} />
          <Route path="motoristas" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="motoristas"><Motoristas /></ProtectedRoute>} />
          <Route path="rotas" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="rotas"><Rotas /></ProtectedRoute>} />
          <Route path="veiculos" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="veiculos"><Veiculos /></ProtectedRoute>} />
          <Route path="historico" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="historico"><Historico /></ProtectedRoute>} />
          <Route path="financeiro" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="financeiro"><Financeiro /></ProtectedRoute>} />
          <Route path="rastreamento" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="rastreamento"><Rastreamento /></ProtectedRoute>} />
          <Route path="mensagens" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="mensagens"><Mensagens /></ProtectedRoute>} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>

        {/* Catch all - redirect to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}


