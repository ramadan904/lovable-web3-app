import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { shouldRetry } from './lib/net.ts'
import { config } from './lib/wagmi.ts'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry, retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000) },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary label="Wallet Bodyguard">
          <App />
        </ErrorBoundary>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
