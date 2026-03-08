import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Planilha from "./pages/Planilha";
import Cofrinho from "./pages/Cofrinho";
import Consultor from "./pages/Consultor";
import Disciplinas from "./pages/Disciplinas";
import StudiesDashboard from "./pages/StudiesDashboard";
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
            <Route path="/planilha" element={<ProtectedRoute><Planilha /></ProtectedRoute>} />
            <Route path="/cofrinho" element={<ProtectedRoute><Cofrinho /></ProtectedRoute>} />
            <Route path="/consultor" element={<ProtectedRoute><Consultor /></ProtectedRoute>} />
            <Route path="/estudos" element={<ProtectedRoute><StudiesDashboard /></ProtectedRoute>} />
            <Route path="/disciplinas" element={<ProtectedRoute><Disciplinas /></ProtectedRoute>} />
            <Route path="/disciplina/:subjectId" element={<ProtectedRoute><SubjectDetail /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/fit" element={<ProtectedRoute><FitDashboard /></ProtectedRoute>} />
            <Route path="/fit/onboarding" element={<ProtectedRoute><FitOnboarding /></ProtectedRoute>} />
            <Route path="/fit/treino" element={<ProtectedRoute><FitWorkout /></ProtectedRoute>} />
            <Route path="/fit/alimentacao" element={<ProtectedRoute><FitMeals /></ProtectedRoute>} />
            <Route path="/fit/progresso" element={<ProtectedRoute><FitProgress /></ProtectedRoute>} />
            <Route path="/fit/chat" element={<ProtectedRoute><FitChat /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
