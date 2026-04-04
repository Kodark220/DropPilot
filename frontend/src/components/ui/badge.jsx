import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-white/10 text-white',
        live: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10',
        ended: 'bg-red-500/15 text-red-400 border border-red-500/20',
        upcoming: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
        sold: 'bg-slate-500/15 text-slate-400 border border-slate-500/20',
        agent: 'bg-violet-500/15 text-violet-400 border border-violet-500/20',
        success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
