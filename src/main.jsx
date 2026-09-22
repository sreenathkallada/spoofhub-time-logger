import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { ToastProvider } from './components/Toast.jsx';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // the request queue already retries transient errors
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
