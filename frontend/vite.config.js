import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const LCD = env.VITE_LCD_ENDPOINT || 'http://192.168.110.117:1317';
  const RPC = env.VITE_RPC_ENDPOINT || 'http://192.168.110.117:26657';
  const CHAIN_ID = env.VITE_CHAIN_ID || 'initiadrops-1';
  const GAS_DENOM = env.VITE_GAS_DENOM || 'umin';

  // Mock L1 chain (required by InterwovenKit — it always looks for is_l1: true)
  const L1_CHAIN = {
    chain_id: 'initiation-2',
    chain_name: 'initia',
    pretty_name: 'Initia L1',
    network_type: 'testnet',
    bech32_prefix: 'init',
    fees: {
      fee_tokens: [{
        denom: 'uinit',
        fixed_min_gas_price: 0.15,
        low_gas_price: 0.15,
        average_gas_price: 0.15,
        high_gas_price: 0.4,
      }],
    },
    apis: {
      rpc: [{ address: 'https://rpc.testnet.initia.xyz' }],
      rest: [{ address: 'https://lcd.testnet.initia.xyz' }],
      indexer: [{ address: 'https://lcd.testnet.initia.xyz' }],
    },
    metadata: {
      is_l1: true,
    },
  };

  const CHAIN_DATA = {
    chain_id: CHAIN_ID,
    chain_name: 'initiadrops',
    pretty_name: 'DropPilot',
    network_type: 'testnet',
    bech32_prefix: 'init',
    fees: {
      fee_tokens: [{
        denom: GAS_DENOM,
        fixed_min_gas_price: 0.15,
        low_gas_price: 0.15,
        average_gas_price: 0.15,
        high_gas_price: 0.4,
      }],
    },
    apis: {
      rpc: [{ address: RPC }],
      rest: [{ address: LCD }],
      indexer: [{ address: LCD }],
    },
    metadata: {
      is_l1: false,
      minitia: { type: 'minimove', version: 'v1.1.11' },
    },
  };

  const chainsJson = JSON.stringify([L1_CHAIN, CHAIN_DATA]);
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
