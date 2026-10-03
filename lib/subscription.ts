export type SubscriptionRow = {
  is_premium: boolean | null;
  expires_at: string | null;
};

export function isSubscriptionActive(
  row: SubscriptionRow | null | undefined,
  now: number = Date.now()
): boolean {
  if (!row || row.is_premium !== true) {
    return false;
  }

  if (row.expires_at == null) {
    return true;
  }

  return new Date(row.expires_at).getTime() > now;
}
