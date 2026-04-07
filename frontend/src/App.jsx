import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useInterwovenKit } from '@initia/interwovenkit-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Sparkles, Store, Bot, Package, Wallet, ChevronRight, Zap } from 'lucide-react';
import { Button } from './components/ui/button';
import { Separator } from './components/ui/separator';
import DropsPage from './components/DropsPage';
import CreateDropPage from './components/CreateDropPage';
import MarketplacePage from './components/MarketplacePage';
import AgentPage from './components/AgentPage';
import MyItemsPage from './components/MyItemsPage';

const navItems = [
  { path: '/', label: 'Drops', icon: Flame },
  { path: '/create', label: 'Create', icon: Sparkles },
  { path: '/marketplace', label: 'Market', icon: Store },
  { path: '/agent', label: 'Agent', icon: Bot },
  { path: '/my-items', label: 'My Items', icon: Package },
];

function App() {
  const { address, username, openConnect, openWallet } = useInterwovenKit();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Ambient background gradients */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] rounded-full bg-violet-600/[0.04] blur-[120px]" />
        <div className="absolute -bottom-[30%] -right-[20%] w-[50%] h-[50%] rounded-full bg-violet-600/[0.03] blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-fuchsia-600/[0.02] blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0D0D0D]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          {/* Logo */}
          <Link to="/" className="flex items-center group">
            <img src="/logo-wordmark.svg" alt="DropPilot" className="h-9 group-hover:opacity-90 transition-opacity duration-300" />
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.04]">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative"
                >
                  <motion.div
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-white/[0.08] rounded-lg border border-white/[0.06]"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                    <Icon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">{item.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          {/* Wallet */}
          {address ? (
            <Button variant="secondary" size="sm" onClick={openWallet} className="gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-xs">
                {username || `${address.slice(0, 6)}...${address.slice(-4)}`}
              </span>
            </Button>
          ) : (
            <Button onClick={openConnect} size="sm" className="gap-2">
              <Wallet className="w-4 h-4" />
              Connect
            </Button>
          )}
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="md:hidden sticky top-16 z-40 border-b border-white/[0.06] bg-[#0D0D0D]/80 backdrop-blur-xl px-4 py-2">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Routes>
              <Route path="/" element={<DropsPage />} />
              <Route path="/create" element={<CreateDropPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/agent" element={<AgentPage />} />
              <Route path="/my-items" element={<MyItemsPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Zap className="w-3.5 h-3.5 text-violet-500" />
            <span>Built on <span className="text-slate-400">Initia</span></span>
            <Separator orientation="vertical" className="h-3 mx-1" />
            <span>Autonomous Agent Commerce</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <span>Powered by Move VM</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
