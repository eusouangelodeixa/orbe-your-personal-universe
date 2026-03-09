import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlanGate } from "@/components/PlanGate";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Planilha from "./pages/Planilha";
import Cofrinho from "./pages/Cofrinho";
import Consultor from "./pages/Consultor";
import Disciplinas from "./pages/Disciplinas";
import StudiesDashboard from "./pages/StudiesDashboard";
import StudiesChat from "./pages/StudiesChat";
import SubjectDetail from "./pages/SubjectDetail";
import Agenda from "./pages/Agenda";
import Profile from "./pages/Profile";
import FitDashboard from "./pages/FitDashboard";
import FitOnboarding from "./pages/FitOnboarding";
import FitWorkout from "./pages/FitWorkout";
import FitMeals from "./pages/FitMeals";
import FitProgress from "./pages/FitProgress";
import FitChat from "./pages/FitChat";
import Tarefas from "./pages/Tarefas";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            {/* Finance routes — all plans */}
            <Route path="/planilha" element={<ProtectedRoute><PlanGate group="finance"><Planilha /></PlanGate></ProtectedRoute>} />
            <Route path="/cofrinho" element={<ProtectedRoute><PlanGate group="finance"><Cofrinho /></PlanGate></ProtectedRoute>} />
            <Route path="/consultor" element={<ProtectedRoute><PlanGate group="finance"><Consultor /></PlanGate></ProtectedRoute>} />
            {/* Studies routes — student & full */}
            <Route path="/estudos" element={<ProtectedRoute><PlanGate group="studies"><StudiesDashboard /></PlanGate></ProtectedRoute>} />
            <Route path="/estudos/chat" element={<ProtectedRoute><PlanGate group="studies"><StudiesChat /></PlanGate></ProtectedRoute>} />
            <Route path="/disciplinas" element={<ProtectedRoute><PlanGate group="studies"><Disciplinas /></PlanGate></ProtectedRoute>} />
            <Route path="/disciplina/:subjectId" element={<ProtectedRoute><PlanGate group="studies"><SubjectDetail /></PlanGate></ProtectedRoute>} />
            {/* Fit routes — fit & full */}
            <Route path="/fit" element={<ProtectedRoute><PlanGate group="fit"><FitDashboard /></PlanGate></ProtectedRoute>} />
            <Route path="/fit/onboarding" element={<ProtectedRoute><PlanGate group="fit"><FitOnboarding /></PlanGate></ProtectedRoute>} />
            <Route path="/fit/treino" element={<ProtectedRoute><PlanGate group="fit"><FitWorkout /></PlanGate></ProtectedRoute>} />
            <Route path="/fit/alimentacao" element={<ProtectedRoute><PlanGate group="fit"><FitMeals /></PlanGate></ProtectedRoute>} />
            <Route path="/fit/progresso" element={<ProtectedRoute><PlanGate group="fit"><FitProgress /></PlanGate></ProtectedRoute>} />
            <Route path="/fit/chat" element={<ProtectedRoute><PlanGate group="fit"><FitChat /></PlanGate></ProtectedRoute>} />
            {/* Shared routes — all plans */}
            <Route path="/agenda" element={<ProtectedRoute><PlanGate group="finance"><Agenda /></PlanGate></ProtectedRoute>} />
            <Route path="/tarefas" element={<ProtectedRoute><PlanGate group="finance"><Tarefas /></PlanGate></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
