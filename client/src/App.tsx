import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/Toast';
import ConfirmModal from './components/ConfirmModal';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { Spinner } from './components/Skeleton';

const ExpertsPage = lazy(() => import('./pages/ExpertsPage'));
const ExpertCreatePage = lazy(() => import('./pages/ExpertCreatePage'));
const ExpertDetailPage = lazy(() => import('./pages/ExpertDetailPage'));
const ConversationsPage = lazy(() => import('./pages/ConversationsPage'));
const ConversationPage = lazy(() => import('./pages/ConversationPage'));
const BackendsPage = lazy(() => import('./pages/BackendsPage'));
const BackendFormPage = lazy(() => import('./pages/BackendFormPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

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
      <ConfirmModal />
      <BrowserRouter>
        <ErrorBoundary>
        <Suspense fallback={<Spinner />}>
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
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/backends/new" element={<BackendFormPage />} />
            <Route path="/backends/:id" element={<BackendFormPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<Navigate to="/settings" replace />} />
            <Route path="/admin" element={<Navigate to="/settings" replace />} />
            <Route path="/admin/*" element={<Navigate to="/settings" replace />} />
            <Route path="/" element={<Navigate to="/conversations" replace />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
