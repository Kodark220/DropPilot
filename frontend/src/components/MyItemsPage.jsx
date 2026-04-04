import React from 'react';
import { useInterwovenKit } from '@initia/interwovenkit-react';
import { useDropsContract } from '../hooks/useDropsContract';
import { motion } from 'framer-motion';
import { Package, Tag, Store, ShoppingBag, Inbox } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Separator } from './ui/separator';

const MOCK_ITEMS = [
  {
    dropId: 1,
    dropName: 'Genesis Hoodie Collection',
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop',
    quantity: 2,
  },
  {
    dropId: 2,
    dropName: 'Cosmic Cat PFP #1',
    image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop',
    quantity: 1,
  },
];

export default function MyItemsPage() {
  const [listingPrice, setListingPrice] = React.useState({});
  const { createListing } = useDropsContract();
  const { address } = useInterwovenKit();

  const handleList = async (dropId) => {
    const price = listingPrice[dropId];
    if (!price) {
      alert('Enter a resale price first');
      return;
    }
    if (!address) {
      alert('Connect your wallet first');
      return;
    }
    try {
      const priceMicro = parseInt(price) * 1_000_000;
      const result = await createListing(dropId, 1, priceMicro, 'uinit');
      alert(`Listed! TX: ${result.transactionHash}`);
    } catch (err) {
      alert(`Listing failed: ${err.message}`);
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
          <span>{MOCK_ITEMS.reduce((sum, i) => sum + i.quantity, 0)} items owned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5 text-emerald-400" />
          <span>{MOCK_ITEMS.length} unique drops</span>
        </div>
      </motion.div>

      {/* Items Grid */}
      {MOCK_ITEMS.length === 0 ? (
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
          {MOCK_ITEMS.map((item, index) => (
            <motion.div
              key={item.dropId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="group card-hover overflow-hidden">
                {/* Image */}
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.dropName}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-transparent to-transparent" />
                  <div className="absolute top-3 right-3">
                    <Badge variant="agent" className="gap-1">
                      <Package className="w-3 h-3" />
                      x{item.quantity}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                    {item.dropName}
                  </h3>

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
