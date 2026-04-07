import React, { useState, useEffect } from 'react';
import { useInterwovenKit } from '@initia/interwovenkit-react';
import { useDropsContract } from '../hooks/useDropsContract';
import { useToast } from './Toast';
import { motion } from 'framer-motion';
import { Store, ShoppingCart, TrendingDown, Tag, User, Loader2, Inbox, Package } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

function ListingCard({ listing, onBuy, index }) {
  const priceInit = (Number(listing.price_per_unit || listing.pricePerUnit || 0) / 1_000_000);
  const sellerDisplay = listing.seller
    ? (listing.seller.startsWith('0x')
      ? `${listing.seller.slice(0, 8)}...${listing.seller.slice(-6)}`
      : `${listing.seller.slice(0, 12)}...${listing.seller.slice(-4)}`)
    : 'Unknown';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="group card-hover overflow-hidden">
        {/* Header */}
        <div className="relative h-28 overflow-hidden bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent flex items-center justify-center">
          <Package className="w-12 h-12 text-violet-400/40" />
          <div className="absolute top-3 right-3">
            <Badge variant="live" className="gap-1">
              <Tag className="w-3 h-3" />
              Listed
            </Badge>
          </div>
          <div className="absolute top-3 left-3">
            <Badge variant="outline" className="text-[10px]">
              Listing #{listing.id}
            </Badge>
          </div>
        </div>

        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
              {listing.dropName || `Drop #${listing.drop_id || listing.dropId}`}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5">
              <User className="w-3 h-3 text-slate-500" />
              <span className="text-xs text-slate-500 font-mono">{sellerDisplay}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2.5 rounded-lg bg-white/[0.02]">
              <p className="text-lg font-bold text-violet-400">{priceInit}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">INIT</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-white/[0.02]">
              <p className="text-lg font-bold text-white">{listing.quantity}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Available</p>
            </div>
          </div>

          <Button className="w-full gap-2" size="sm" onClick={() => onBuy(listing.id)}>
            <ShoppingCart className="w-3.5 h-3.5" />
            Buy Now
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function MarketplacePage() {
  const { buyListing, getAllListings, getDrop } = useDropsContract();
  const { address } = useInterwovenKit();
  const toast = useToast();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const raw = await getAllListings();
        // Enrich with drop names
        const enriched = await Promise.all(raw.map(async (listing) => {
          const dropId = listing.drop_id || listing.dropId;
          try {
            const r = await getDrop(dropId);
            const info = JSON.parse(r.data);
            return { ...listing, dropName: info.name, dropDescription: info.description };
          } catch {
            return { ...listing, dropName: `Drop #${dropId}` };
          }
        }));
        if (!cancelled) setListings(enriched);
      } catch (err) {
        console.error('Failed to load listings:', err);
        if (!cancelled) setListings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const handleBuy = async (listingId) => {
    if (!address) {
      toast.warning('Connect your wallet first');
      return;
    }
    try {
      const result = await buyListing(listingId);
      toast.success(`Purchase successful! TX: ${result.transactionHash?.slice(0, 16)}...`);
      // Refresh listings
      const raw = await getAllListings();
      setListings(raw);
    } catch (err) {
      toast.error(`Purchase failed: ${err.message}`);
    }
  };

  const floorPrice = listings.length > 0
    ? Math.min(...listings.map(l => Number(l.price_per_unit || l.pricePerUnit || 0) / 1_000_000))
    : 0;

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
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Secondary Market</h1>
            <p className="text-sm text-slate-500">Resale listings from other users.</p>
          </div>
        </div>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex gap-6 text-xs text-slate-500"
      >
        <div className="flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5 text-violet-400" />
          <span>{listings.length} active listing{listings.length !== 1 ? 's' : ''}</span>
        </div>
        {floorPrice > 0 && (
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-violet-400" />
            <span>Floor: {floorPrice} INIT</span>
          </div>
        )}
      </motion.div>

      {/* Listings grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <span className="ml-3 text-slate-500">Loading listings from chain...</span>
        </div>
      ) : listings.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="py-16 text-center">
            <Inbox className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-lg">No active listings</p>
            <p className="text-slate-600 text-sm mt-1">List your items from the My Items page.</p>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((listing, index) => (
            <ListingCard key={listing.id} listing={listing} onBuy={handleBuy} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
