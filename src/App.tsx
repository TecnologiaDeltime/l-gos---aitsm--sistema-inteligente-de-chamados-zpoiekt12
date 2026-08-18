import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { ThemeProvider } from '@/hooks/use-theme'
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
import ClientEdit from '@/pages/clients/ClientEdit'
import ContractList from '@/pages/contracts/ContractList'
import ContractDetail from '@/pages/contracts/ContractDetail'
import ContractEdit from '@/pages/contracts/ContractEdit'
import ContractView from '@/pages/contracts/ContractView'
import ContractsDashboard from '@/pages/contracts/ContractsDashboard'
import TeamList from '@/pages/team/TeamList'
import TeamDetail from '@/pages/team/TeamDetail'
import QueueManagement from '@/pages/queues/QueueManagement'
import CategoryManagement from '@/pages/categories/CategoryManagement'
import ActivityCatalog from '@/pages/ActivityCatalog'
import ReportsPage from '@/pages/reports/ReportsPage'
import SlaDashboard from '@/pages/reports/SlaDashboard'
import RecurrentActivities from '@/pages/reports/RecurrentActivities'
import SlaGoalsPage from '@/pages/reports/SlaGoalsPage'
import ScheduledReportsPage from '@/pages/reports/ScheduledReportsPage'
import KnowledgeBase from '@/pages/knowledge/KnowledgeBase'
import SettingsPage from '@/pages/settings/SettingsPage'
import SlaSettings from '@/pages/settings/SlaSettings'
import TicketTemplates from '@/pages/settings/TicketTemplates'
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
import OperatorDashboard from '@/pages/dashboard/OperatorDashboard'
import ManagerDashboard from '@/pages/dashboard/ManagerDashboard'
import ExecutiveDashboard from '@/pages/dashboard/ExecutiveDashboard'
import ContractConsumptionDashboard from '@/pages/contracts/ContractConsumptionDashboard'
import ConsumoContratosPlaceholder from '@/pages/contracts/ConsumoContratosPlaceholder'
import DashboardContratosPlaceholder from '@/pages/contracts/DashboardContratosPlaceholder'
import ClientHoursPage from '@/pages/clients/ClientHoursPage'
import BlockingManagement from '@/pages/blocking/BlockingManagement'
import NotFound from '@/pages/NotFound'
import PortalPage from '@/pages/portal/PortalPage'
import UnitReportsPage from '@/pages/reports/UnitReportsPage'
import ClientExtractionPage from '@/pages/reports/ClientExtractionPage'
import AutomationList from '@/pages/automations/AutomationList'
import AutomationEditor from '@/pages/automations/AutomationEditor'
import AutomationDashboard from '@/pages/automations/AutomationDashboard'
import ApprovalCenter from '@/pages/approvals/ApprovalCenter'
import TechnicalAgenda from '@/pages/visits/TechnicalAgenda'
import VisitManagerDashboard from '@/pages/visits/VisitManagerDashboard'
import TechnicianDashboardPage from '@/pages/visits/TechnicianDashboardPage'
import TravelDashboard from '@/pages/visits/TravelDashboard'
import ReimbursementDashboard from '@/pages/visits/ReimbursementDashboard'
import OperationalMap from '@/pages/visits/OperationalMap'
import ChangeDashboard from '@/pages/changes/ChangeDashboard'
import ChangeList from '@/pages/changes/ChangeList'
import MyChanges from '@/pages/changes/MyChanges'
import PendingApprovals from '@/pages/changes/PendingApprovals'
import ChangeCalendar from '@/pages/changes/ChangeCalendar'
import ChangeCommittee from '@/pages/changes/ChangeCommittee'
import ChangeTypes from '@/pages/changes/ChangeTypes'
import ChangeTemplates from '@/pages/changes/ChangeTemplates'
import ChangeReports from '@/pages/changes/ChangeReports'
import ChangeSettings from '@/pages/changes/ChangeSettings'
import ChangeDetail from '@/pages/changes/ChangeDetail'
import ChangeCreate from '@/pages/changes/ChangeCreate'
import ProblemDashboard from '@/pages/problems/ProblemDashboard'
import ProblemList from '@/pages/problems/ProblemList'
import ProblemCreate from '@/pages/problems/ProblemCreate'
import ProblemDetail from '@/pages/problems/ProblemDetail'
import MyProblems from '@/pages/problems/MyProblems'
import ProblemInvestigation from '@/pages/problems/ProblemInvestigation'
import ProblemEffectivenessAnalysis from '@/pages/problems/ProblemEffectivenessAnalysis'
import ProblemPending from '@/pages/problems/ProblemPending'
import ProblemClosed from '@/pages/problems/ProblemClosed'
import KnownErrors from '@/pages/problems/KnownErrors'
import ProblemReports from '@/pages/problems/ProblemReports'
import ProblemSettings from '@/pages/problems/ProblemSettings'
import VisitCreatePage from '@/pages/visits-n2/VisitCreatePage'
import MyVisitsPage from '@/pages/visits-n2/MyVisitsPage'
import VisitDetailPage from '@/pages/visits-n2/VisitDetailPage'
import TravelEntriesPage from '@/pages/visits-n2/TravelEntriesPage'
import ExpensesPage from '@/pages/visits-n2/ExpensesPage'
import ServiceOrdersPage from '@/pages/visits-n2/ServiceOrdersPage'
import ClientSignaturesPage from '@/pages/visits-n2/ClientSignaturesPage'
import VisitChecklistsPage from '@/pages/visits-n2/VisitChecklistsPage'
import RecurringVisitsPage from '@/pages/visits-n2/RecurringVisitsPage'
import TechnicianAvailabilityPage from '@/pages/visits-n2/TechnicianAvailabilityPage'
import KmRatesPage from '@/pages/visits-n2/KmRatesPage'
import VisitReportsPage from '@/pages/visits-n2/VisitReportsPage'
import { GlobalNotifications } from '@/components/GlobalNotifications'
import { SlaResponseAlerts } from '@/components/SlaResponseAlerts'
import { useAuth } from '@/hooks/use-auth'

function RootRedirect() {
  const { user } = useAuth()
  const target = user?.role === 'cliente_solicitante' ? '/portal' : '/dashboard'
  return <Navigate to={target} replace />
}

const App = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <GlobalNotifications />
          <SlaResponseAlerts />
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-senha" element={<RecoverPassword />} />
            <Route path="/approval/:token" element={<ApprovalPublic />} />
            <Route path="/survey/:token" element={<SurveyPublic />} />

            {/* Portal Route (protected, separate layout) */}
            <Route
              path="/portal"
              element={
                <ProtectedRoute>
                  <PortalPage />
                </ProtectedRoute>
              }
            />

            {/* Protected Routes inside Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<RootRedirect />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard-gerencial" element={<ExecutiveDashboard />} />
              <Route path="/tickets" element={<TicketList />} />
              <Route path="/tickets/new" element={<TicketCreate />} />
              <Route path="/tickets/:id" element={<TicketDetail />} />
              <Route path="/chamados/novo" element={<TicketCreate />} />
              <Route path="/aprovacoes" element={<ApprovalList />} />
              <Route path="/categorias" element={<CategoryManagement />} />
              <Route path="/catalogo" element={<ActivityCatalog />} />
              <Route path="/clients" element={<ClientList />} />
              <Route path="/clients/new" element={<ClientDetail />} />
              <Route path="/clients/:id/edit" element={<ClientEdit />} />
              <Route path="/contracts" element={<ContractList />} />
              <Route path="/contracts/dashboard" element={<ContractsDashboard />} />
              <Route path="/contracts/new" element={<ContractDetail />} />
              <Route path="/contracts/:id" element={<ContractView />} />
              <Route path="/contracts/:id/edit" element={<ContractEdit />} />
              <Route path="/team" element={<TeamList />} />
              <Route path="/team/new" element={<TeamDetail />} />
              <Route path="/queues" element={<QueueManagement />} />
              <Route path="/categories" element={<CategoryManagement />} />
              <Route path="/activity-catalog" element={<ActivityCatalog />} />
              <Route path="/sla-dashboard" element={<SlaDashboard />} />
              <Route path="/recurrent-activities" element={<RecurrentActivities />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/sla-goals" element={<SlaGoalsPage />} />
              <Route path="/scheduled-reports" element={<ScheduledReportsPage />} />
              <Route path="/reports/unit" element={<UnitReportsPage />} />
              <Route path="/reports/clients" element={<ClientExtractionPage />} />
              <Route path="/knowledge-base" element={<KnowledgeBase />} />
              <Route path="/cmdb" element={<CmdbDashboard />} />
              <Route path="/cmdb/assets" element={<CiList />} />
              <Route path="/cmdb/configuration-items" element={<CiList />} />
              <Route path="/cmdb/assets/new" element={<CiCreate />} />
              <Route path="/cmdb/assets/:id" element={<CiDetail />} />
              <Route path="/cmdb/import" element={<CiImport />} />
              <Route path="/cmdb/types" element={<CiTypes />} />
              <Route path="/approvals" element={<ApprovalList />} />
              <Route path="/visits" element={<VisitList />} />
              <Route path="/satisfaction" element={<SatisfactionDashboard />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/sla" element={<SlaSettings />} />
              <Route path="/settings/ticket-templates" element={<TicketTemplates />} />
              <Route path="/operator-dashboard" element={<OperatorDashboard />} />
              <Route path="/manager-dashboard" element={<ManagerDashboard />} />
              <Route path="/contracts/consumption" element={<ContractConsumptionDashboard />} />
              <Route path="/consumo-contratos" element={<ConsumoContratosPlaceholder />} />
              <Route path="/dashboard-contratos" element={<DashboardContratosPlaceholder />} />
              <Route path="/horas-clientes" element={<ClientHoursPage />} />
              <Route path="/blocking" element={<BlockingManagement />} />
              <Route path="/automations" element={<AutomationList />} />
              <Route path="/automations/dashboard" element={<AutomationDashboard />} />
              <Route path="/automations/:id/edit" element={<AutomationEditor />} />
              <Route path="/approval-center" element={<ApprovalCenter />} />
              <Route path="/agenda-tecnica" element={<TechnicalAgenda />} />
              <Route path="/visits/dashboard" element={<VisitManagerDashboard />} />
              <Route path="/visits/technician-dashboard" element={<TechnicianDashboardPage />} />
              <Route path="/visits/travel-dashboard" element={<TravelDashboard />} />
              <Route path="/visits/reimbursement-dashboard" element={<ReimbursementDashboard />} />
              <Route path="/visits/map" element={<OperationalMap />} />
              <Route path="/changes" element={<ChangeDashboard />} />
              <Route path="/changes/list" element={<ChangeList />} />
              <Route path="/changes/new" element={<ChangeCreate />} />
              <Route path="/changes/my" element={<MyChanges />} />
              <Route path="/changes/pending" element={<PendingApprovals />} />
              <Route path="/changes/calendar" element={<ChangeCalendar />} />
              <Route path="/changes/committee" element={<ChangeCommittee />} />
              <Route path="/changes/types" element={<ChangeTypes />} />
              <Route path="/changes/templates" element={<ChangeTemplates />} />
              <Route path="/changes/reports" element={<ChangeReports />} />
              <Route path="/changes/settings" element={<ChangeSettings />} />
              <Route path="/changes/:id" element={<ChangeDetail />} />
              <Route path="/problems" element={<ProblemDashboard />} />
              <Route path="/problems/list" element={<ProblemList />} />
              <Route path="/problems/new" element={<ProblemCreate />} />
              <Route path="/problems/my" element={<MyProblems />} />
              <Route path="/problems/investigation" element={<ProblemInvestigation />} />
              <Route path="/problems/effectiveness" element={<ProblemEffectivenessAnalysis />} />
              <Route path="/problems/pending" element={<ProblemPending />} />
              <Route path="/problems/closed" element={<ProblemClosed />} />
              <Route path="/problems/known-errors" element={<KnownErrors />} />
              <Route path="/problems/reports" element={<ProblemReports />} />
              <Route path="/problems/settings" element={<ProblemSettings />} />
              <Route path="/problems/:id" element={<ProblemDetail />} />
              <Route path="/visitas-n2/dashboard" element={<VisitManagerDashboard />} />
              <Route path="/visitas-n2/calendar" element={<TechnicalAgenda />} />
              <Route path="/visitas-n2/list" element={<VisitList />} />
              <Route path="/visitas-n2/new" element={<VisitCreatePage />} />
              <Route path="/visitas-n2/my" element={<MyVisitsPage />} />
              <Route path="/visitas-n2/travel" element={<TravelEntriesPage />} />
              <Route path="/visitas-n2/expenses" element={<ExpensesPage />} />
              <Route path="/visitas-n2/reimbursements" element={<ReimbursementDashboard />} />
              <Route path="/visitas-n2/service-orders" element={<ServiceOrdersPage />} />
              <Route path="/visitas-n2/signatures" element={<ClientSignaturesPage />} />
              <Route path="/visitas-n2/checklists" element={<VisitChecklistsPage />} />
              <Route path="/visitas-n2/recurring" element={<RecurringVisitsPage />} />
              <Route path="/visitas-n2/availability" element={<TechnicianAvailabilityPage />} />
              <Route path="/visitas-n2/km-rates" element={<KmRatesPage />} />
              <Route path="/visitas-n2/reports" element={<VisitReportsPage />} />
              <Route path="/visitas-n2/:id" element={<VisitDetailPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
)

export default App
