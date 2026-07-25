import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

import Login from '@/pages/Login'
import RecoverPassword from '@/pages/RecoverPassword'
import Dashboard from '@/pages/Dashboard'
import TicketList from '@/pages/tickets/TicketList'
import TicketDetail from '@/pages/tickets/TicketDetail'
import TicketCreate from '@/pages/tickets/TicketCreate'
import ClientList from '@/pages/clients/ClientList'
import ClientDetail from '@/pages/clients/ClientDetail'
import ContractList from '@/pages/contracts/ContractList'
import ContractDetail from '@/pages/contracts/ContractDetail'
import ContractEdit from '@/pages/contracts/ContractEdit'
import ContractView from '@/pages/contracts/ContractView'
import ContractsDashboard from '@/pages/contracts/ContractsDashboard'
import TeamList from '@/pages/team/TeamList'
import TeamDetail from '@/pages/team/TeamDetail'
import QueueManagement from '@/pages/queues/QueueManagement'
import CategoryManagement from '@/pages/categories/CategoryManagement'
import ReportsPage from '@/pages/reports/ReportsPage'
import KnowledgeBase from '@/pages/knowledge/KnowledgeBase'
import SettingsPage from '@/pages/settings/SettingsPage'
import CmdbDashboard from '@/pages/cmdb/CmdbDashboard'
import CiList from '@/pages/cmdb/CiList'
import CiCreate from '@/pages/cmdb/CiCreate'
import CiDetail from '@/pages/cmdb/CiDetail'
import CiImport from '@/pages/cmdb/CiImport'
import CiTypes from '@/pages/cmdb/CiTypes'
import ApprovalList from '@/pages/approvals/ApprovalList'
import ApprovalPublic from '@/pages/approvals/ApprovalPublic'
import VisitList from '@/pages/visits/VisitList'
import SatisfactionDashboard from '@/pages/satisfaction/SatisfactionDashboard'
import SurveyPublic from '@/pages/satisfaction/SurveyPublic'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-senha" element={<RecoverPassword />} />
          <Route path="/approval/:token" element={<ApprovalPublic />} />
          <Route path="/survey/:token" element={<SurveyPublic />} />

          {/* Protected Routes inside Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tickets" element={<TicketList />} />
            <Route path="/tickets/new" element={<TicketCreate />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/new" element={<ClientDetail />} />
            <Route path="/contracts" element={<ContractList />} />
            <Route path="/contracts/dashboard" element={<ContractsDashboard />} />
            <Route path="/contracts/new" element={<ContractDetail />} />
            <Route path="/contracts/:id" element={<ContractView />} />
            <Route path="/contracts/:id/edit" element={<ContractEdit />} />
            <Route path="/team" element={<TeamList />} />
            <Route path="/team/new" element={<TeamDetail />} />
            <Route path="/queues" element={<QueueManagement />} />
            <Route path="/categories" element={<CategoryManagement />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/knowledge-base" element={<KnowledgeBase />} />
            <Route path="/cmdb" element={<CmdbDashboard />} />
            <Route path="/cmdb/assets" element={<CiList />} />
            <Route path="/cmdb/assets/new" element={<CiCreate />} />
            <Route path="/cmdb/assets/:id" element={<CiDetail />} />
            <Route path="/cmdb/import" element={<CiImport />} />
            <Route path="/cmdb/types" element={<CiTypes />} />
            <Route path="/approvals" element={<ApprovalList />} />
            <Route path="/visits" element={<VisitList />} />
            <Route path="/satisfaction" element={<SatisfactionDashboard />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
