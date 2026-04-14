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
import { NetworkProvider, getSelectedNetwork } from './contexts/NetworkContext';
import App from './App';
import './index.css';

// ===== ACTIVE NETWORK CONFIG =====
const NET = getSelectedNetwork();
export const MODULE_ADDRESS = NET.moduleAddress;
export const GAS_DENOM = NET.gasDenom;
export const CHAIN_ID = NET.chainId;
export const LCD_ENDPOINT = NET.lcdEndpoint;
export const RPC_ENDPOINT = NET.rpcEndpoint;
export const AGENT_API_URL = NET.agentApiUrl;
// ==================================

// Intercept endpoints the rollup doesn't implement
if (NET.isRollup) {
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

// Chain definition
const INITIA_DROPS_CHAIN = {
  chain_id: CHAIN_ID,
  chain_name: NET.chainName,
  pretty_name: 'DropPilot on Initia',
  network_type: 'testnet',
  bech32_prefix: 'init',
  fees: {
    fee_tokens: [
      {
        denom: GAS_DENOM,
        fixed_min_gas_price: NET.gasPrice,
        low_gas_price: NET.gasPrice,
        average_gas_price: NET.gasPrice,
        high_gas_price: NET.gasPrice * 1.5,
      },
    ],
  },
  apis: {
    rpc: [{ address: RPC_ENDPOINT }],
    rest: [{ address: LCD_ENDPOINT }],
    indexer: [{ address: NET.indexer }],
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
      <NetworkProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </NetworkProvider>
    </Providers>
  </React.StrictMode>,
);
