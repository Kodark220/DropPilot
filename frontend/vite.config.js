import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Both chain definitions for network switching
  const L1_CHAIN = {
    chain_id: 'initiation-2',
    chain_name: 'initia',
    pretty_name: 'DropPilot on Initia',
    network_type: 'testnet',
    bech32_prefix: 'init',
    fees: { fee_tokens: [{ denom: 'uinit', fixed_min_gas_price: 0.015, low_gas_price: 0.015, average_gas_price: 0.015, high_gas_price: 0.04 }] },
    apis: { rpc: [{ address: 'https://rpc.testnet.initia.xyz' }], rest: [{ address: 'https://rest.testnet.initia.xyz' }], indexer: [{ address: 'https://indexer.initiation-2.initia.xyz' }] },
    metadata: { is_l1: true },
  };

  const ROLLUP_CHAIN = {
    chain_id: 'droppilot-1',
    chain_name: 'droppilot',
    pretty_name: 'DropPilot Rollup',
    network_type: 'testnet',
    bech32_prefix: 'init',
    fees: { fee_tokens: [{ denom: 'umin', fixed_min_gas_price: 0.15, low_gas_price: 0.15, average_gas_price: 0.15, high_gas_price: 0.2 }] },
    apis: { rpc: [{ address: 'http://localhost:26657' }], rest: [{ address: 'http://localhost:1317' }], indexer: [{ address: 'http://localhost:1317' }] },
    metadata: { is_l1: true },
  };

  const chainsJson = JSON.stringify([L1_CHAIN, ROLLUP_CHAIN]);
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
