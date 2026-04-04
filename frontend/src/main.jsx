import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, WagmiProvider } from 'wagmi';
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
export const GAS_DENOM = import.meta.env.VITE_GAS_DENOM || 'umin';
export const CHAIN_ID = import.meta.env.VITE_CHAIN_ID || 'initiadrops-1';
export const LCD_ENDPOINT = import.meta.env.VITE_LCD_ENDPOINT || 'http://192.168.110.117:1317';
export const RPC_ENDPOINT = import.meta.env.VITE_RPC_ENDPOINT || 'http://192.168.110.117:26657';
export const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || 'http://localhost:3100';
// ==============================================================

// Custom chain definition for our local rollup
const INITIA_DROPS_CHAIN = {
  chain_id: CHAIN_ID,
  chain_name: 'initiadrops',
  pretty_name: 'DropPilot',
  network_type: 'testnet',
  bech32_prefix: 'init',
  fees: {
    fee_tokens: [
      {
        denom: GAS_DENOM,
        fixed_min_gas_price: 0.15,
        low_gas_price: 0.15,
        average_gas_price: 0.15,
        high_gas_price: 0.4,
      },
    ],
  },
  apis: {
    rpc: [{ address: RPC_ENDPOINT }],
    rest: [{ address: LCD_ENDPOINT }],
    indexer: [{ address: LCD_ENDPOINT }],
  },
  metadata: {
    is_l1: false,
    minitia: {
      type: 'minimove',
      version: 'v1.1.11',
    },
  },
};

const wagmiConfig = createConfig({
  connectors: [initiaPrivyWalletConnector],
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
});

const queryClient = new QueryClient();

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
            usernamesModuleAddress=""
            lockStakeModuleAddress=""
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
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Providers>
  </React.StrictMode>,
);
