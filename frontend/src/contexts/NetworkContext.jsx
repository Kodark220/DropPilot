import React, { createContext, useContext } from 'react';

// ===== Network Presets =====
const NETWORKS = {
  l1: {
    key: 'l1',
    label: 'Initia L1',
    chainId: 'initiation-2',
    chainName: 'initia',
    lcdEndpoint: 'https://rest.testnet.initia.xyz',
    rpcEndpoint: 'https://rpc.testnet.initia.xyz',
    indexer: 'https://indexer.initiation-2.initia.xyz',
    gasDenom: 'uinit',
    gasPrice: 0.015,
    agentApiUrl: 'https://droppilot.onrender.com',
    moduleAddress: 'init1vhaytr72cd8se33xnleua8m8wxncgmdjtnvlhf',
    isRollup: false,
  },
  rollup: {
    key: 'rollup',
    label: 'DropPilot Rollup',
    chainId: 'droppilot-1',
    chainName: 'droppilot',
    lcdEndpoint: 'http://localhost:1317',
    rpcEndpoint: 'http://localhost:26657',
    indexer: 'http://localhost:1317',
    gasDenom: 'umin',
    gasPrice: 0.15,
    agentApiUrl: 'http://localhost:3100',
    moduleAddress: 'init1vhaytr72cd8se33xnleua8m8wxncgmdjtnvlhf',
    isRollup: true,
  },
};

const STORAGE_KEY = 'droppilot-network';

export function getSelectedNetwork() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && NETWORKS[stored]) return NETWORKS[stored];
  } catch {}
  return NETWORKS.l1;
}

export function switchNetwork(key) {
  localStorage.setItem(STORAGE_KEY, key);
  window.location.reload();
}

const NetworkContext = createContext(null);

export function NetworkProvider({ children }) {
  const network = getSelectedNetwork();
  return (
    <NetworkContext.Provider value={network}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider');
  return ctx;
}

export { NETWORKS };
