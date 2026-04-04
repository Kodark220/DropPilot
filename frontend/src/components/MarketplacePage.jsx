import React from 'react';
import { useInterwovenKit } from '@initia/interwovenkit-react';
import { useDropsContract } from '../hooks/useDropsContract';
import { motion } from 'framer-motion';
import { Store, ShoppingCart, Bot, TrendingDown, ArrowUpRight, Tag, User } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

const MOCK_LISTINGS = [
  {
    id: 1,
    dropId: 1,
    dropName: 'Genesis Hoodie Collection',
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop',
    seller: 'init1sel...abc',
    quantity: 1,
    pricePerUnit: 45,
    originalPrice: 30,
    active: true,
  },
  {
    id: 2,
    dropId: 1,
    dropName: 'Genesis Hoodie Collection',
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop',
    seller: 'init1sel...xyz',
    quantity: 2,
    pricePerUnit: 40,
    originalPrice: 30,
    active: true,
  },
  {
    id: 3,
    dropId: 2,
    dropName: 'Cosmic Cat PFP #1',
    image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop',
    seller: 'init1sel...cat',
    quantity: 1,
    pricePerUnit: 25,
    originalPrice: 15,
    active: true,
  },
];

function ListingCard({ listing, onBuy, index }) {
  const markup = Math.round(((listing.pricePerUnit - listing.originalPrice) / listing.originalPrice) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="group card-hover overflow-hidden">
        {/* Image */}
        <div className="relative h-40 overflow-hidden">
          <img
            src={listing.image}
            alt={listing.dropName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-transparent to-transparent" />

          <div className="absolute top-3 right-3">
            <Badge variant="live" className="gap-1">
              <Tag className="w-3 h-3" />
              Listed
            </Badge>
          </div>

          <div className="absolute bottom-3 left-3">
            <Badge className="bg-black/50 backdrop-blur-sm border-0 text-[10px] gap-1">
              <ArrowUpRight className="w-3 h-3 text-amber-400" />
              +{markup}%
            </Badge>
          </div>
        </div>

        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
              {listing.dropName}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5">
              <User className="w-3 h-3 text-slate-500" />
              <span className="text-xs text-slate-500 font-mono">{listing.seller}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2.5 rounded-lg bg-white/[0.02]">
              <p className="text-lg font-bold text-violet-400">{listing.pricePerUnit}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">INIT</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-white/[0.02]">
              <p className="text-lg font-bold text-white">{listing.quantity}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Available</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1 gap-2" size="sm" onClick={() => onBuy(listing.id)}>
              <ShoppingCart className="w-3.5 h-3.5" />
              Buy Now
            </Button>
            <Button variant="agent" size="sm" className="gap-1.5" onClick={() => onBuy(listing.id)}>
              <Bot className="w-3.5 h-3.5" />
              Auto
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function MarketplacePage() {
  const { buyListing } = useDropsContract();
  const { address } = useInterwovenKit();

  const handleBuy = async (listingId) => {
    if (!address) {
      alert('Connect your wallet first');
      return;
    }
    try {
      const result = await buyListing(listingId);
      alert(`Purchase successful! TX: ${result.transactionHash}`);
    } catch (err) {
      alert(`Purchase failed: ${err.message}`);
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
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-cyan-600 shadow-lg shadow-emerald-500/20">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Secondary Market</h1>
            <p className="text-sm text-slate-500">Resale listings from other users. Your agent can auto-snipe deals.</p>
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
          <Store className="w-3.5 h-3.5 text-emerald-400" />
          <span>{MOCK_LISTINGS.length} active listings</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
          <span>Floor: 25 INIT</span>
        </div>
      </motion.div>

      {/* Listings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {MOCK_LISTINGS.map((listing, index) => (
          <ListingCard key={listing.id} listing={listing} onBuy={handleBuy} index={index} />
        ))}
      </div>
    </div>
  );
}
