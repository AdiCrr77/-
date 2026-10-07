import { internalMutation } from './_generated/server.js';
import { v } from 'convex/values';
import { reserveCall } from './lib/rules.js';

// Transcript-only Clarity verification consumes the existing shared AI quota.
export const reserve = internalMutation({
  args: {}, returns: v.boolean(),
  handler: async ctx => {
    const limit = await ctx.db.query('callLimits').withIndex('by_name',q=>q.eq('name','ai')).unique();
    const timestamps = reserveCall(limit?.timestamps ?? [],Date.now());
    if (!timestamps) return false;
    if (limit) await ctx.db.patch(limit._id,{timestamps});
    else await ctx.db.insert('callLimits',{name:'ai',timestamps});
    return true;
  },
});
