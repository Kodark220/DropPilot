import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const LCD = env.VITE_LCD_ENDPOINT || 'https://rest.testnet.initia.xyz';
  const RPC = env.VITE_RPC_ENDPOINT || 'https://rpc.testnet.initia.xyz';
  const CHAIN_ID = env.VITE_CHAIN_ID || 'initiation-2';
  const GAS_DENOM = env.VITE_GAS_DENOM || 'uinit';

  // L1 chain definition (our contract is deployed directly on L1 testnet)
  const CHAIN_DATA = {
    chain_id: CHAIN_ID,
    chain_name: 'initia',
    pretty_name: 'DropPilot on Initia',
    network_type: 'testnet',
    bech32_prefix: 'init',
    fees: {
      fee_tokens: [{
        denom: GAS_DENOM,
        fixed_min_gas_price: 0.015,
        low_gas_price: 0.015,
        average_gas_price: 0.015,
        high_gas_price: 0.04,
      }],
    },
    apis: {
      rpc: [{ address: RPC }],
      rest: [{ address: LCD }],
      indexer: [{ address: LCD }],
    },
    metadata: {
      is_l1: true,
    },
  };

  const chainsJson = JSON.stringify([CHAIN_DATA]);
  const profilesJson = JSON.stringify([]);

  // Dev: intercept requests with mock data
  function mockRegistryPlugin() {
    return {
      name: 'mock-registry',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/chains.json') {
            res.setHeader('Content-Type', 'application/json');
            res.end(chainsJson);
            return;
          }
          if (req.url === '/profiles.json') {
            res.setHeader('Content-Type', 'application/json');
            res.end(profilesJson);
            return;
          }
          if (req.url?.endsWith('.json') && !req.url.includes('/src/') && !req.url.includes('/node_modules/') && !req.url.includes('/@')) {
            const segments = req.url.split('/').filter(Boolean);
            if (segments.length === 1) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
          }
          if (req.url?.startsWith('/v2/')) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
            return;
          }
          next();
        });
      },
    };
  }

  // Build: emit registry files into dist/
  function registryBuildPlugin() {
    return {
      name: 'registry-build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'chains.json', source: chainsJson });
        this.emitFile({ type: 'asset', fileName: 'profiles.json', source: profilesJson });
      },
    };
  }

  return {
    plugins: [react(), mockRegistryPlugin(), registryBuildPlugin()],
    server: {
      port: 3001,
    },
  };
});
