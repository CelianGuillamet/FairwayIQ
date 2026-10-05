import type { Round } from '../types';
import { supabase } from './supabase';
import { getErrorCode } from './round-save';

export type BadgeRoundRow = Pick<Round, 'id' | 'played_at' | 'total_score' | 'par' | 'holes'>;
export type RoundsClient = Pick<typeof supabase, 'from'>;

const COLUMNS = 'id, played_at, total_score, par, holes';

export const BADGE_ROUNDS_PAGE_SIZE = 100;
export const BADGE_ROUNDS_CAP = 500;

// The rounds store only holds the first pages: this reads every round, newest first, for the
// score-based catch-up. A failed page drops the whole list, as a partial one would misdate badges.
export async function fetchRoundsForBadges(client: RoundsClient = supabase): Promise<BadgeRoundRow[] | null> {
  const rows: BadgeRoundRow[] = [];

  try {
    for (let from = 0; from < BADGE_ROUNDS_CAP; from += BADGE_ROUNDS_PAGE_SIZE) {
      const to = Math.min(from + BADGE_ROUNDS_PAGE_SIZE, BADGE_ROUNDS_CAP) - 1;
      const { data, error } = await client
        .from('rounds')
        .select(COLUMNS)
        .order('played_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);

      if (error) {
        console.warn('[badges] rounds unavailable for the catch-up', getErrorCode(error));
        return null;
      }

      const page = (data ?? []) as BadgeRoundRow[];
      rows.push(...page);

      if (page.length <= to - from) {
        break;
      }
    }
  } catch (error) {
    console.warn('[badges] rounds unavailable for the catch-up', getErrorCode(error));
    return null;
  }

  return rows;
}
