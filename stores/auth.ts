import { create } from 'zustand';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase, clearStoredAuthSession } from '../lib/supabase';
import { nextPasswordRecovery } from '../lib/recovery-session';
import { resetPurchasesUser } from '../lib/purchases';
import { resetHolesData } from '../lib/holes-data';
import { clearRoundDraft } from '../lib/round-draft';
import type { Profile } from '../types';
import { useRoundsStore } from './rounds';
import { useDrillsStore } from './drills';

export type OnboardingValues = Pick<Profile, 'display_name' | 'handicap' | 'play_frequency' | 'goal'>;

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  passwordRecovery: boolean;
  setSession: (session: Session | null, event?: AuthChangeEvent) => void;
  setPasswordRecovery: (value: boolean) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<void>;
  completeOnboarding: (values: OnboardingValues) => Promise<'saved' | 'already_complete'>;
  signOut: () => Promise<void>;
};

// Only the newest profile write may land: an older response must not bring back a stale profile
// (e.g. onboarding_complete=false right after onboarding finished).
let profileSequence = 0;

function resetUserCaches() {
  useRoundsStore.getState().reset();
  useDrillsStore.getState().reset();
  resetHolesData();
}

async function endAuthSession() {
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      return;
    }

    console.warn('[auth] Global sign-out failed', { message: error.message });
    const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
    if (!localError) {
      return;
    }
  } catch (error) {
    console.warn('[auth] Sign-out crashed', { message: error instanceof Error ? error.message : String(error) });
  }

  // Both calls above contact the server first and bail out on a network error without touching
  // the stored session, so the user would be signed in again after a restart.
  await clearStoredAuthSession().catch((error) => {
    console.warn('[auth] Clearing stored session failed', { message: error instanceof Error ? error.message : String(error) });
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,
  profileError: null,
  passwordRecovery: false,

  setSession: (session, event) => {
    const prevUserId = get().user?.id;
    const nextUserId = session?.user?.id ?? null;
    const shouldResetProfile = !session || prevUserId !== nextUserId;

    if (prevUserId && prevUserId !== nextUserId) {
      resetUserCaches();
    }

    set({
      session,
      user: session?.user ?? null,
      profile: shouldResetProfile ? null : get().profile,
      loading: false,
      profileLoading: !!session && shouldResetProfile,
      profileError: shouldResetProfile ? null : get().profileError,
      passwordRecovery: nextPasswordRecovery(get().passwordRecovery, event, !!session),
    });
  },

  // A PKCE exchange emits SIGNED_IN rather than PASSWORD_RECOVERY, so the reset screen raises this
  // itself before exchanging, otherwise the sign-in redirect would send the user home first.
  setPasswordRecovery: (passwordRecovery) => set({ passwordRecovery }),

  setProfile: (profile) => {
    profileSequence++;
    set({ profile, profileLoading: false, profileError: null });
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) {
      set({ profile: null, profileLoading: false, profileError: null });
      return;
    }

    const userId = user.id;
    const sequence = ++profileSequence;
    set({ profileLoading: true, profileError: null });

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (sequence !== profileSequence || get().user?.id !== userId) {
      return;
    }

    if (error) {
      console.warn('[auth] Profile fetch failed', {
        userId,
        message: error.message,
      });
      set({ profileLoading: false, profileError: error.message });
      return;
    }

    console.info('[auth] Profile fetch completed', {
      userId,
      found: !!data,
      onboardingComplete: data?.onboarding_complete ?? null,
    });
    set({ profile: data ?? null, profileLoading: false, profileError: null });
  },

  // The signup trigger creates the row with onboarding_complete=false; a completed profile
  // must never be overwritten by a user who was routed here by a failed profile fetch.
  completeOnboarding: async (values) => {
    const userId = get().user?.id;
    if (!userId) {
      throw new Error('Not signed in');
    }

    const applyProfile = (profile: Profile) => {
      profileSequence++;
      if (get().user?.id === userId) {
        set({ profile, profileLoading: false, profileError: null });
      }
    };

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ ...values, onboarding_complete: true })
      .eq('user_id', userId)
      .eq('onboarding_complete', false)
      .select()
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }
    if (updated) {
      applyProfile(updated);
      return 'saved';
    }

    const { data: existing, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }
    if (existing) {
      applyProfile(existing);
      return 'already_complete';
    }

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert({ user_id: userId, ...values, onboarding_complete: true })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }
    applyProfile(inserted);
    return 'saved';
  },

  signOut: async () => {
    const userId = get().user?.id;

    await endAuthSession();

    void resetPurchasesUser();
    resetUserCaches();
    if (userId) {
      void clearRoundDraft(userId).catch(() => undefined);
    }
    profileSequence++;
    set({
      session: null,
      user: null,
      profile: null,
      loading: false,
      profileLoading: false,
      profileError: null,
      passwordRecovery: false,
    });
  },
}));
