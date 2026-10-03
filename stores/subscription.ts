import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { isSubscriptionActive } from '../lib/subscription';
import { useAuthStore } from './auth';

const PURCHASE_GRACE_MS = 10 * 60 * 1000;

type SubscriptionState = {
  isPremium: boolean;
  loading: boolean;
  purchaseGraceUntil: number;
  refresh: () => Promise<void>;
  markPremium: () => void;
  markFree: () => void;
  reset: () => void;
};

let refreshSequence = 0;

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPremium: false,
  loading: false,
  purchaseGraceUntil: 0,

  refresh: async () => {
    const userId = useAuthStore.getState().user?.id;
    const sequence = ++refreshSequence;

    if (!userId) {
      set({ isPremium: false, loading: false, purchaseGraceUntil: 0 });
      return;
    }

    set({ loading: true });

    const { data, error } = await supabase
      .from('subscriptions')
      .select('is_premium, expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (sequence !== refreshSequence) {
      return;
    }

    if (error) {
      console.warn('[subscription] Fetch failed', { userId, message: error.message });
      set({ loading: false });
      return;
    }

    // The webhook can lag behind a purchase, so a row that still says "free"
    // must not undo the premium state set right after the purchase.
    const inPurchaseGrace = Date.now() < get().purchaseGraceUntil;
    set({ isPremium: isSubscriptionActive(data) || inPurchaseGrace, loading: false });
  },

  markPremium: () => set({ isPremium: true, purchaseGraceUntil: Date.now() + PURCHASE_GRACE_MS }),

  markFree: () => set({ isPremium: false, purchaseGraceUntil: 0 }),

  reset: () => {
    refreshSequence++;
    set({ isPremium: false, loading: false, purchaseGraceUntil: 0 });
  },
}));
