import React, { useState, useEffect } from 'react';
import { useInterwovenKit } from '@initia/interwovenkit-react';
import { useDropsContract } from '../hooks/useDropsContract';
import { useToast } from './Toast';
import { AGENT_API_URL } from '../main';
import { motion } from 'framer-motion';
import { Clock, ShoppingCart, Bot, TrendingUp, Users, Zap, ArrowRight, Timer, Loader2, PackageOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

const DROP_IMAGES = [
  'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=400&fit=crop',
];

function getDropStatus(drop) {
  const now = Date.now() / 1000;
  const sold = Number(drop.sold || 0);
  const totalSupply = Number(drop.total_supply || drop.totalSupply || 1);
  const startTime = Number(drop.start_time || drop.startTime || 0);
  const endTime = Number(drop.end_time || drop.endTime || 0);
  if (sold >= totalSupply) return 'sold-out';
  if (now < startTime) return 'upcoming';
  if (now > endTime) return 'ended';
  return 'live';
}

function formatCountdown(seconds) {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const statusConfig = {
  live: { badge: 'live', label: 'LIVE', dot: 'bg-emerald-400' },
  upcoming: { badge: 'upcoming', label: 'UPCOMING', dot: 'bg-amber-400' },
  ended: { badge: 'ended', label: 'ENDED', dot: 'bg-red-400' },
  'sold-out': { badge: 'sold', label: 'SOLD OUT', dot: 'bg-slate-400' },
};

function DropCard({ drop, onPurchase, onAutoBuy, index }) {
  const [now, setNow] = useState(Date.now() / 1000);
  const status = getDropStatus(drop);
  const config = statusConfig[status];

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(interval);
  }, []);

  const sold = Number(drop.sold || 0);
  const totalSupply = Number(drop.total_supply || drop.totalSupply || 1);
  const maxPerUser = Number(drop.max_per_user || drop.maxPerUser || 1);
  const priceDisplay = Number(drop.price || 0) / 1_000_000;
  const startTime = Number(drop.start_time || drop.startTime || 0);
  const endTime = Number(drop.end_time || drop.endTime || 0);
  const progress = (sold / totalSupply) * 100;
  const timeLeft = status === 'live' ? endTime - now : status === 'upcoming' ? startTime - now : 0;
  const image = DROP_IMAGES[(drop.id - 1) % DROP_IMAGES.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="group card-hover overflow-hidden">
        {/* Image header */}
        <div className="relative h-48 overflow-hidden">
          <img
            src={image}
            alt={drop.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-transparent to-transparent" />

          {/* Status badge */}
          <div className="absolute top-3 right-3">
            <Badge variant={config.badge} className="gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === 'live' ? 'animate-pulse' : ''}`} />
              {config.label}
            </Badge>
          </div>

          {/* Category */}
          <div className="absolute top-3 left-3">
            <Badge variant="default" className="bg-black/50 backdrop-blur-sm border-0 text-[10px]">
              Drop #{drop.id}
            </Badge>
          </div>

          {/* Countdown overlay for live/upcoming */}
          {(status === 'live' || status === 'upcoming') && (
            <div className="absolute bottom-3 left-3 right-3">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-lg px-3 py-2">
                <Timer className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  {status === 'live' ? 'Ends in' : 'Starts in'}
                </span>
                <span className="countdown-display text-sm font-bold text-white ml-auto">
                  {formatCountdown(timeLeft)}
                </span>
              </div>
            </div>
          )}
        </div>

        <CardContent className="p-5 space-y-4">
          {/* Title & description */}
          <div>
            <h3 className="text-base font-semibold text-white group-hover:text-violet-300 transition-colors">
              {drop.name}
            </h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{drop.description}</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
              <p className="text-base font-bold text-violet-400">{priceDisplay}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">INIT</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
              <p className="text-base font-bold text-white">{sold}<span className="text-slate-500 font-normal">/{totalSupply}</span></p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Minted</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
              <p className="text-base font-bold text-slate-300">{maxPerUser}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Max</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>{Math.round(progress)}% minted</span>
              <span>{totalSupply - sold} remaining</span>
            </div>
            <Progress
              value={progress}
              indicatorClassName={status === 'live' ? 'from-emerald-500 to-cyan-500' : undefined}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            {status === 'live' && (
              <Button className="w-full gap-2" size="sm" onClick={() => onPurchase(drop.id, 1)}>
                <ShoppingCart className="w-3.5 h-3.5" />
                Buy Now
              </Button>
            )}
            {status === 'upcoming' && (
              <Button variant="agent" className="w-full gap-2" size="sm" onClick={() => onAutoBuy(drop.id)}>
                <Bot className="w-3.5 h-3.5" />
                Auto Buy with Agent
              </Button>
            )}
            {(status === 'ended' || status === 'sold-out') && (
              <Button variant="outline" className="w-full gap-2" size="sm">
                <TrendingUp className="w-3.5 h-3.5" />
                View on Secondary
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DropsPage() {
  const { purchase, getAllDrops, getAgentWallet } = useDropsContract();
  const { address } = useInterwovenKit();
  const toast = useToast();
  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getAllDrops();
        if (!cancelled) setDrops(data);
      } catch (e) {
        console.error('Failed to load drops:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handlePurchase = async (dropId, quantity) => {
    if (!address) {
      toast.warning('Connect your wallet first');
      return;
    }
    try {
      const result = await purchase(dropId, quantity);
      toast.success(`Purchase successful! TX: ${result.transactionHash?.slice(0, 16)}...`);
      // Refresh drops
      const data = await getAllDrops();
      setDrops(data);
    } catch (err) {
      toast.error(`Purchase failed: ${err.message}`);
    }
  };

  const handleAutoBuy = async (dropId) => {
    if (!address) {
      toast.warning('Connect your wallet first');
      return;
    }
    try {
      // Check if user has authorized the agent on-chain
      let agentWallet;
      try {
        agentWallet = await getAgentWallet(address);
      } catch {
        // get_agent_wallet throws if no AgentWallet resource exists
        agentWallet = null;
      }
      if (!agentWallet || !agentWallet.active) {
        toast.warning('You need to authorize and fund the agent first! Go to the Agent page to set it up.');
        return;
      }

      const res = await fetch(`${AGENT_API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          watchDropIds: [dropId],
          autoBuyEnabled: true,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(`Agent watching drop #${dropId}! Watching ${data.watching?.length || 1} drop(s) total.`);
    } catch (err) {
      toast.error(`Auto-buy registration failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-950/40 via-[#0D0D0D] to-indigo-950/30 p-8 md:p-12"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.08),transparent_50%)]" />
        <div className="relative z-10 max-w-2xl">
          <Badge variant="agent" className="mb-4 gap-1.5">
            <Zap className="w-3 h-3" />
            Agent-Powered
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            Never Miss a <span className="gradient-text">Drop Again</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-6">
            Your AI agent watches, bids, and buys limited drops the instant they go live.
            Powered by Initia auto-signing for zero-friction purchases.
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-violet-400" />
              <span>67 active buyers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>3 live drops</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-amber-400" />
              <span>12 agents active</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Active Drops</h2>
          <p className="text-sm text-slate-500 mt-0.5">Limited drops from top creators</p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-slate-400">
          View All <ArrowRight className="w-3 h-3" />
        </Button>
      </div>

      {/* Drop cards grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-violet-400" />
          <p className="text-sm">Loading drops from chain...</p>
        </div>
      ) : drops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <PackageOpen className="w-12 h-12 mb-3 text-slate-600" />
          <p className="text-base font-medium text-slate-400">No drops yet</p>
          <p className="text-sm mt-1">Create the first drop to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {drops.map((drop, index) => (
            <DropCard key={drop.id} drop={drop} onPurchase={handlePurchase} onAutoBuy={handleAutoBuy} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
