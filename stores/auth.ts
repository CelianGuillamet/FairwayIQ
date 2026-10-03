import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { resetPurchasesUser } from '../lib/purchases';
import type { Profile } from '../types';
import { useRoundsStore } from './rounds';
import { useDrillsStore } from './drills';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,
  profileError: null,

  setSession: (session) => {
    const prevUserId = get().user?.id;
    const nextUserId = session?.user?.id ?? null;
    const shouldResetProfile = !session || prevUserId !== nextUserId;

    if (prevUserId && prevUserId !== nextUserId) {
      useRoundsStore.setState({ rounds: [], loading: true, initialized: false, error: null });
      useDrillsStore.setState({ completions: [], recommendedCategories: [] });
    }

    set({
      session,
      user: session?.user ?? null,
      profile: shouldResetProfile ? null : get().profile,
      loading: false,
      profileLoading: !!session && shouldResetProfile,
      profileError: null,
    });
  },

  setProfile: (profile) => set({ profile, profileLoading: false, profileError: null }),

  fetchProfile: async () => {
    const { user } = get();
    if (!user) {
      set({ profile: null, profileLoading: false, profileError: null });
      return;
    }

    set({ profileLoading: true, profileError: null });

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[auth] Profile fetch failed', {
        userId: user.id,
        message: error.message,
      });
      set({ profile: null, profileLoading: false, profileError: error.message });
      return;
    }

    console.info('[auth] Profile fetch completed', {
      userId: user.id,
      found: !!data,
      onboardingComplete: data?.onboarding_complete ?? null,
    });
    set({ profile: data ?? null, profileLoading: false, profileError: null });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    void resetPurchasesUser();
    useRoundsStore.setState({ rounds: [], loading: true, initialized: false, error: null });
    useDrillsStore.setState({ completions: [], recommendedCategories: [] });
    set({
      session: null,
      user: null,
      profile: null,
      loading: false,
      profileLoading: false,
      profileError: null,
    });
  },
}));
