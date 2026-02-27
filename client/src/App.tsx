import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import ProtectedRoute from './components/ProtectedRoute';
import ToastContainer from './components/Toast';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ExpertsPage from './pages/ExpertsPage';
import ExpertCreatePage from './pages/ExpertCreatePage';
import ExpertDetailPage from './pages/ExpertDetailPage';
import ConversationsPage from './pages/ConversationsPage';
import ConversationPage from './pages/ConversationPage';
import BackendsPage from './pages/BackendsPage';
import BackendFormPage from './pages/BackendFormPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContainer />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/conversations" element={<ConversationsPage />} />
            <Route path="/conversations/:id" element={<ConversationPage />} />
            <Route path="/experts" element={<ExpertsPage />} />
            <Route path="/experts/new" element={<ExpertCreatePage />} />
            <Route path="/experts/:id" element={<ExpertDetailPage />} />
            <Route path="/backends" element={<BackendsPage />} />
            <Route path="/backends/new" element={<BackendFormPage />} />
            <Route path="/backends/:id" element={<BackendFormPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/" element={<Navigate to="/conversations" replace />} />
          </Route>

          {/* Admin routes (stub) */}
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            {/* Future admin pages go here */}
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
