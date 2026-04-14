import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Layers, Wifi } from 'lucide-react';
import { NETWORKS, switchNetwork, useNetwork } from '../contexts/NetworkContext';

export default function NetworkSwitcher() {
  const network = useNetwork();
  const [open, setOpen] = useState(false);
  const [rollupOnline, setRollupOnline] = useState(null);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Check if rollup is reachable
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(NETWORKS.rollup.lcdEndpoint + '/cosmos/base/tendermint/v1beta1/node_info', {
          signal: AbortSignal.timeout(3000),
        });
        setRollupOnline(res.ok);
      } catch {
        setRollupOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  const options = [
    { ...NETWORKS.l1, online: true, icon: Globe },
    { ...NETWORKS.rollup, online: rollupOnline, icon: Layers },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
          bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
      >
        <div className={`w-2 h-2 rounded-full ${network.isRollup
          ? (rollupOnline ? 'bg-fuchsia-400' : 'bg-red-400')
          : 'bg-emerald-400'
        }`} />
        <span className="text-slate-200">{network.label}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/[0.08]
              bg-[#141414] shadow-xl shadow-black/50 overflow-hidden z-50"
          >
            {options.map((opt) => {
              const Icon = opt.icon;
              const isActive = network.key === opt.key;
              const isDisabled = opt.key === 'rollup' && rollupOnline === false;
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (isDisabled || isActive) return;
                    switchNetwork(opt.key);
                  }}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors
                    ${isActive ? 'bg-white/[0.06] text-white' : 'text-slate-300 hover:bg-white/[0.04]'}
                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  <div className="flex-1">
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{opt.chainId}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {opt.key === 'rollup' && rollupOnline === null && (
                      <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                    )}
                    {opt.online === true && (
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                    {opt.online === false && opt.key === 'rollup' && (
                      <span className="text-[10px] text-red-400">offline</span>
                    )}
                    {isActive && (
                      <span className="text-[10px] text-violet-400 font-medium">active</span>
                    )}
                  </div>
                </button>
              );
            })}
            <div className="px-4 py-2 border-t border-white/[0.06]">
              <p className="text-[10px] text-slate-500">
                {network.isRollup
                  ? 'Connected to local DropPilot rollup'
                  : 'Connected to Initia L1 testnet'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
