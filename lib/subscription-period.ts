import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from './supabase';

export type SubscriptionPeriod = {
  plan: string | null;
  expires_at: string | null;
};

export async function fetchSubscriptionPeriod(userId: string): Promise<SubscriptionPeriod | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[subscription] Period fetch failed', { message: error.message });
    return null;
  }

  return data;
}

export function describeSubscriptionPeriod(period: SubscriptionPeriod | null | undefined) {
  const planLabel = period?.plan === 'annual' ? 'Annuel' : period?.plan === 'monthly' ? 'Mensuel' : null;
  const expiry = period?.expires_at ? new Date(period.expires_at) : null;
  const until = expiry && !Number.isNaN(expiry.getTime()) ? `valable jusqu’au ${format(expiry, 'd MMMM yyyy', { locale: fr })}` : null;

  return { planLabel, until };
}
