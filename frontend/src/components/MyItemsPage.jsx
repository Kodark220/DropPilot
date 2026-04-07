import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { useInterwovenKit } from '@initia/interwovenkit-react';
import { useDropsContract } from '../hooks/useDropsContract';
import { motion } from 'framer-motion';
import { Package, Tag, Store, ShoppingBag, Inbox, Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Separator } from './ui/separator';

export default function MyItemsPage() {
  const [listingPrice, setListingPrice] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { createListing, getUserOwned, getAllDrops } = useDropsContract();
  const { address } = useInterwovenKit();
  const toast = useToast();

  // Load owned items from chain
  useEffect(() => {
    if (!address) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function loadItems() {
      setLoading(true);
      try {
        const drops = await getAllDrops();
        const owned = [];
        await Promise.all(drops.map(async (drop) => {
          try {
            const result = await getUserOwned(address, drop.id);
            const qty = parseInt(JSON.parse(result.data));
            if (qty > 0) {
              owned.push({
                dropId: drop.id,
                dropName: drop.name || `Drop #${drop.id}`,
                description: drop.description || '',
                price: Number(drop.price || 0) / 1_000_000,
                quantity: qty,
              });
            }
          } catch { /* skip */ }
        }));
        if (!cancelled) setItems(owned);
      } catch (err) {
        console.error('Failed to load items:', err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadItems();
    return () => { cancelled = true; };
  }, [address]);

  const handleList = async (dropId) => {
    const price = listingPrice[dropId];
    if (!price) {
      toast.warning('Enter a resale price first');
      return;
    }
    if (!address) {
      toast.warning('Connect your wallet first');
      return;
    }
    try {
      const priceMicro = parseInt(price) * 1_000_000;
      const result = await createListing(dropId, 1, priceMicro, 'uinit');
      toast.success(`Listed! TX: ${result.transactionHash?.slice(0, 16)}...`);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('0x9000d')) {
        toast.error('Listing failed: You don\'t own any items from this drop. Purchase first!');
      } else {
        toast.error(`Listing failed: ${msg}`);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/20">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">My Items</h1>
            <p className="text-sm text-slate-500">Your purchased drops. List them on the secondary market.</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex gap-6 text-xs text-slate-500"
      >
        <div className="flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5 text-violet-400" />
          <span>{items.reduce((sum, i) => sum + i.quantity, 0)} items owned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5 text-emerald-400" />
          <span>{items.length} unique drops</span>
        </div>
      </motion.div>

      {/* Items Grid */}
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-16"
        >
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <span className="ml-3 text-slate-500">Loading your items from chain...</span>
        </motion.div>
      ) : !address ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="py-16 text-center">
            <Inbox className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-lg">Connect your wallet</p>
            <p className="text-slate-600 text-sm mt-1">Connect your wallet to see your items.</p>
          </Card>
        </motion.div>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="py-16 text-center">
            <Inbox className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-lg">No items yet</p>
            <p className="text-slate-600 text-sm mt-1">Go buy some drops!</p>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, index) => (
            <motion.div
              key={item.dropId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="group card-hover overflow-hidden">
                {/* Header with gradient */}
                <div className="relative h-28 overflow-hidden bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent flex items-center justify-center">
                  <Package className="w-12 h-12 text-violet-400/40" />
                  <div className="absolute top-3 right-3">
                    <Badge variant="agent" className="gap-1">
                      <Package className="w-3 h-3" />
                      x{item.quantity}
                    </Badge>
                  </div>
                  <div className="absolute top-3 left-3">
                    <Badge variant="outline" className="text-[10px]">
                      Drop #{item.dropId}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                    {item.dropName}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
                  )}
                  <p className="text-xs text-slate-400">Purchased at {item.price} INIT each</p>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-slate-500 mb-1.5">
                        <Tag className="w-3 h-3" />
                        Resale Price (INIT)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="45"
                        value={listingPrice[item.dropId] || ''}
                        onChange={(e) =>
                          setListingPrice({ ...listingPrice, [item.dropId]: e.target.value })
                        }
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => handleList(item.dropId)}
                    >
                      <Store className="w-3.5 h-3.5" />
                      List on Market
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
