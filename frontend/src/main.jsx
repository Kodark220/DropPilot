import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { ToastProvider } from './components/Toast';
import { mainnet } from 'wagmi/chains';
import {
  initiaPrivyWalletConnector,
  injectStyles,
  InterwovenKitProvider,
} from '@initia/interwovenkit-react';
import InterwovenKitStyles from '@initia/interwovenkit-react/styles.js';
import App from './App';
import './index.css';

// ===== CONFIGURATION (driven by env vars for production) =====
export const MODULE_ADDRESS = import.meta.env.VITE_MODULE_ADDRESS || 'init1vhaytr72cd8se33xnleua8m8wxncgmdjtnvlhf';
export const GAS_DENOM = import.meta.env.VITE_GAS_DENOM || 'uinit';
export const CHAIN_ID = import.meta.env.VITE_CHAIN_ID || 'initiation-2';
export const LCD_ENDPOINT = import.meta.env.VITE_LCD_ENDPOINT || 'https://rest.testnet.initia.xyz';
export const RPC_ENDPOINT = import.meta.env.VITE_RPC_ENDPOINT || 'https://rpc.testnet.initia.xyz';
export const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || 'https://droppilot.onrender.com';
// ==============================================================

// Intercept endpoints the rollup doesn't implement
const isRollup = CHAIN_ID !== 'initiation-2';
if (isRollup) {
  const _fetch = window.fetch;
  window.fetch = function (url, ...args) {
    const u = typeof url === 'string' ? url : url?.url || '';
    if (u.includes('/initia/tx/v1/gas_prices')) {
      return Promise.resolve(new Response(
        JSON.stringify({ gas_prices: [{ denom: GAS_DENOM, amount: '0.15' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ));
    }
    return _fetch.call(this, url, ...args);
  };
}

// Chain definition — DropPilot rollup (or L1 depending on env)
const INITIA_DROPS_CHAIN = {
  chain_id: CHAIN_ID,
  chain_name: isRollup ? 'droppilot' : 'initia',
  pretty_name: 'DropPilot on Initia',
  network_type: 'testnet',
  bech32_prefix: 'init',
  fees: {
    fee_tokens: [
      {
        denom: GAS_DENOM,
        fixed_min_gas_price: isRollup ? 0.15 : 0.015,
        low_gas_price: isRollup ? 0.15 : 0.015,
        average_gas_price: isRollup ? 0.15 : 0.015,
        high_gas_price: isRollup ? 0.2 : 0.04,
      },
    ],
  },
  apis: {
    rpc: [{ address: RPC_ENDPOINT }],
    rest: [{ address: LCD_ENDPOINT }],
    indexer: [{ address: isRollup ? LCD_ENDPOINT : 'https://indexer.initiation-2.initia.xyz' }],
  },
  metadata: {
    is_l1: true,
  },
};

const wagmiConfig = createConfig({
  connectors: [initiaPrivyWalletConnector],
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry 500s from missing modules (lock_staking, usernames)
        if (error?.message?.includes('500')) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#f8fafc', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#94a3b8' }}>{this.state.error?.message}</p>
          <button
            className="btn-primary"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            style={{ marginTop: 16 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Providers({ children }) {
  useEffect(() => {
    injectStyles(InterwovenKitStyles);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <ErrorBoundary>
          <InterwovenKitProvider
            defaultChainId={CHAIN_ID}
            customChain={INITIA_DROPS_CHAIN}
            registryUrl={window.location.origin}
            routerApiUrl=""
            glyphUrl=""
            minityUrl=""
            dexUrl=""
            vipUrl=""
            enableAutoSign
            theme="dark"
            disableAnalytics
          >
            {children}
          </InterwovenKitProvider>
        </ErrorBoundary>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </Providers>
  </React.StrictMode>,
);
