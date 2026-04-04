import React, { useState, useRef, useEffect } from 'react';
import { useInterwovenKit } from '@initia/interwovenkit-react';
import { useDropsContract } from '../hooks/useDropsContract';
import { MODULE_ADDRESS } from '../main';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Send, Shield, ShieldOff, Wallet, Zap, Eye, Coins,
  CircleDot, ArrowRight, Sparkles, MessageSquare, ChevronRight, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';

export default function AgentPage() {
  const { address, autoSign } = useInterwovenKit();
  const { authorizeAgent, revokeAgent, fundAgent } = useDropsContract();
  const chatEndRef = useRef(null);

  const [budget, setBudget] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [isFunding, setIsFunding] = useState(false);

  const [agentStatus, setAgentStatus] = useState({
    authorized: false,
    agent: '',
    budget: 0,
    spent: 0,
    active: false,
  });

  const [chatMessages, setChatMessages] = useState([
    {
      role: 'agent',
      text: "Hi! I'm your DropPilot agent. I can auto-buy drops, snipe secondary market deals, and manage your collection. What would you like me to do?",
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleAuthorize = async () => {
    if (!address) {
      alert('Connect your wallet first');
      return;
    }
    try {
      const budgetMicro = parseInt(budget) * 1_000_000;
      await authorizeAgent(MODULE_ADDRESS, budgetMicro);
      if (autoSign?.enable) await autoSign.enable();

      setAgentStatus({
        authorized: true,
        agent: MODULE_ADDRESS,
        budget: parseInt(budget) || 100,
        spent: 0,
        active: true,
      });
    } catch (err) {
      alert(`Failed to authorize agent: ${err.message}`);
    }
  };

  const handleRevoke = async () => {
    try {
      await revokeAgent();
      if (autoSign?.disable) await autoSign.disable();
      setAgentStatus({ ...agentStatus, active: false });
    } catch (err) {
      alert(`Failed to revoke agent: ${err.message}`);
    }
  };

  const handleFund = async () => {
    if (!address) {
      alert('Connect your wallet first');
      return;
    }
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      alert('Enter a valid amount');
      return;
    }
    setIsFunding(true);
    try {
      const amountMicro = Math.floor(parseFloat(fundAmount) * 1_000_000);
      const result = await fundAgent(amountMicro);
      alert(`Funded agent with ${fundAmount} INIT! TX: ${result.transactionHash}`);
      setFundAmount('');
    } catch (err) {
      alert(`Funding failed: ${err.message}`);
    } finally {
      setIsFunding(false);
    }
  };

  const handleChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');

    setTimeout(() => {
      let response = '';
      const lower = userMsg.toLowerCase();

      if (lower.includes('buy') && lower.includes('hoodie')) {
        response =
          'Found "Genesis Hoodie Collection" — 30 INIT each, 33 left. I\'ll auto-buy 1 for you when the next slot opens. Budget remaining: ' +
          (agentStatus.budget - agentStatus.spent - 30) +
          ' INIT.';
      } else if (lower.includes('watch') || lower.includes('alert')) {
        response =
          "Got it! I'm now watching for new drops matching your preferences. I'll auto-purchase within your budget the moment they go live.";
      } else if (lower.includes('snipe') || lower.includes('secondary')) {
        response =
          'Scanning secondary market... Found 3 listings under your max price. The best deal is Genesis Hoodie at 40 INIT (resale). Want me to buy it?';
      } else if (lower.includes('budget') || lower.includes('status')) {
        response = `Agent Status:\n• Budget: ${agentStatus.budget} INIT\n• Spent: ${agentStatus.spent} INIT\n• Remaining: ${agentStatus.budget - agentStatus.spent} INIT\n• Active: ${agentStatus.active ? 'Yes' : 'No'}`;
      } else if (lower.includes('yes') || lower.includes('go') || lower.includes('do it')) {
        response = 'Executing purchase via auto-sign... Done! Transaction confirmed. Receipt added to your inventory.';
      } else {
        response =
          'I can help you with:\n• "Buy [item name]" — purchase from active drops\n• "Watch for [criteria]" — set alerts\n• "Snipe secondary under [price]" — auto-buy resale deals\n• "Show budget status" — check your agent wallet';
      }

      setChatMessages((prev) => [...prev, { role: 'agent', text: response }]);
    }, 800);
  };

  const remaining = agentStatus.budget - agentStatus.spent;
  const spentPct = agentStatus.budget > 0 ? (agentStatus.spent / agentStatus.budget) * 100 : 0;

  const steps = [
    { icon: Shield, label: 'Authorize agent with a budget' },
    { icon: Eye, label: 'Tell the agent what to watch' },
    { icon: Zap, label: 'Auto-sign purchases instantly' },
    { icon: Wallet, label: 'Receipts go to your wallet' },
    { icon: ShieldOff, label: 'Revoke anytime' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column — Config */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-5"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Agent</h1>
            <p className="text-sm text-slate-500">Authorize an agent to auto-buy drops on your behalf.</p>
          </div>
        </div>

        {/* Agent Wallet Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="w-4 h-4 text-violet-400" />
              Agent Wallet
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5">
            <AnimatePresence mode="wait">
              {agentStatus.authorized && agentStatus.active ? (
                <motion.div
                  key="active"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CircleDot className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-400">Agent Active</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-xl bg-white/[0.02]">
                      <p className="text-2xl font-bold text-violet-400">{agentStatus.budget}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Budget (INIT)</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white/[0.02]">
                      <p className="text-2xl font-bold text-emerald-400">{remaining}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Remaining</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Spent: {agentStatus.spent} INIT</span>
                      <span>{Math.round(spentPct)}%</span>
                    </div>
                    <Progress value={spentPct} />
                  </div>

                  <p className="text-xs text-slate-600 font-mono truncate">
                    Agent: {agentStatus.agent}
                  </p>

                  <Button variant="destructive" className="w-full gap-2" onClick={handleRevoke}>
                    <ShieldOff className="w-4 h-4" />
                    Revoke Agent Access
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="setup"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {/* Connected Wallet Display */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Your Wallet</label>
                    <div className="flex h-11 w-full items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm">
                      {address ? (
                        <span className="text-white font-mono truncate">{address}</span>
                      ) : (
                        <span className="text-slate-500">Connect wallet to continue</span>
                      )}
                    </div>
                  </div>

                  {/* Agent Address Display */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Agent Address</label>
                    <div className="flex h-11 w-full items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm">
                      <span className="text-violet-400 font-mono truncate">{MODULE_ADDRESS}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Budget (INIT)</label>
                    <Input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="100"
                    />
                  </div>
                  <Button variant="agent" className="w-full gap-2" onClick={handleAuthorize} disabled={!address}>
                    <Bot className="w-4 h-4" />
                    Authorize Agent
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-amber-400" />
              How Auto-Buy Works
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5">
            <div className="space-y-3">
              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] text-slate-500">
                    <step.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-slate-400">{step.label}</span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Fund Agent Wallet */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="w-4 h-4 text-emerald-400" />
              Fund Agent Wallet
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs text-slate-500">
              Send INIT tokens to the agent so it can execute purchases on your behalf.
            </p>
            <div className="flex h-9 w-full items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs">
              <span className="text-slate-500 mr-1.5">To:</span>
              <span className="text-violet-400 font-mono truncate">{MODULE_ADDRESS}</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="Amount (INIT)"
                className="flex-1"
              />
              <Button
                variant="glow"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={handleFund}
                disabled={!address || isFunding}
              >
                {isFunding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {isFunding ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Right Column — Chat */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="flex flex-col"
      >
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-bold text-white">Agent Chat</h2>
          <Badge variant="agent" className="text-[10px]">AI</Badge>
        </div>

        <Card className="flex-1 flex flex-col min-h-[560px]">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-violet-500/20 border border-violet-500/20 text-violet-100'
                        : 'bg-white/[0.04] border border-white/[0.06] text-slate-300'
                    }`}
                  >
                    {msg.role === 'agent' && (
                      <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold mb-1">
                        <Bot className="w-3 h-3" /> DropPilot
                      </span>
                    )}
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          <Separator />
          <form onSubmit={handleChat} className="flex items-center gap-2 p-3">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Tell your agent what to do..."
              className="flex-1"
            />
            <Button type="submit" size="icon" className="shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
