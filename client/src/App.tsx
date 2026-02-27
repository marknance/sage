import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';

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
      <BrowserRouter>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <h1 className="text-2xl font-semibold text-text-primary">
            Sage - Loading...
          </h1>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
