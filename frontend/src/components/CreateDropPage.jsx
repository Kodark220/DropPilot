import React, { useState } from 'react';
import { useDropsContract } from '../hooks/useDropsContract';
import { motion } from 'framer-motion';
import { Sparkles, Package, Clock, Users, Coins, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

export default function CreateDropPage() {
  const { createDrop, address } = useDropsContract();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    totalSupply: '',
    maxPerUser: '1',
    startTime: '',
    endTime: '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!address) {
      alert('Connect your wallet first');
      return;
    }
    setLoading(true);
    try {
      const startTimestamp = Math.floor(new Date(form.startTime).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(form.endTime).getTime() / 1000);
      const priceInMicro = parseInt(form.price) * 1_000_000;

      const result = await createDrop({
        name: form.name,
        description: form.description,
        price: priceInMicro,
        paymentDenom: 'umin',
        totalSupply: parseInt(form.totalSupply),
        maxPerUser: parseInt(form.maxPerUser),
        startTime: startTimestamp,
        endTime: endTimestamp,
      });
      alert(`Drop created! TX: ${result.transactionHash}`);
    } catch (err) {
      alert(`Failed to create drop: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isValid = form.name && form.price && form.totalSupply && form.startTime && form.endTime;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Create a Drop</h1>
            <p className="text-sm text-slate-500">Launch a limited product for your community</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="glow-violet">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name & Description */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider font-medium">
                  <FileText className="w-3.5 h-3.5" />
                  Details
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Drop Name</label>
                  <Input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Genesis Hoodie Collection"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Description</label>
                  <Textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe your drop..."
                    rows={3}
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* Pricing & Supply */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider font-medium">
                  <Coins className="w-3.5 h-3.5" />
                  Pricing & Supply
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Price (INIT)</label>
                    <Input
                      name="price"
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={handleChange}
                      placeholder="30"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Total Supply</label>
                    <Input
                      name="totalSupply"
                      type="number"
                      min="1"
                      value={form.totalSupply}
                      onChange={handleChange}
                      placeholder="100"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    Max Per User
                    <Badge variant="agent" className="text-[10px] px-2 py-0">Sybil Protection</Badge>
                  </label>
                  <Input
                    name="maxPerUser"
                    type="number"
                    min="1"
                    value={form.maxPerUser}
                    onChange={handleChange}
                    placeholder="1"
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* Timing */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Schedule
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Start Time</label>
                    <Input
                      name="startTime"
                      type="datetime-local"
                      value={form.startTime}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">End Time</label>
                    <Input
                      name="endTime"
                      type="datetime-local"
                      value={form.endTime}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Preview summary */}
              {isValid && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-xl bg-violet-500/[0.05] border border-violet-500/10 p-4"
                >
                  <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Preview</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white font-medium">{form.name || '—'}</span>
                    <Badge variant="live" className="text-[10px]">{form.totalSupply} units</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {form.price} INIT each · Max {form.maxPerUser}/user · Revenue: {(form.price * form.totalSupply).toLocaleString()} INIT
                  </p>
                </motion.div>
              )}

              <Button type="submit" className="w-full gap-2" size="lg" disabled={loading || !isValid}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Drop...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Launch Drop
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
